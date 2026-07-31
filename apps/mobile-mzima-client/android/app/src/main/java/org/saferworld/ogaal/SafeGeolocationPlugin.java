package org.saferworld.ogaal;

import android.Manifest;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import java.util.List;

@CapacitorPlugin(
    name = "SafeGeolocation",
    permissions = {
        @Permission(
            strings = { Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION },
            alias = SafeGeolocationPlugin.LOCATION_PERMISSION
        ),
        @Permission(
            strings = { Manifest.permission.ACCESS_COARSE_LOCATION },
            alias = SafeGeolocationPlugin.COARSE_LOCATION_PERMISSION
        )
    }
)
public class SafeGeolocationPlugin extends Plugin {

    static final String LOCATION_PERMISSION = "location";
    static final String COARSE_LOCATION_PERMISSION = "coarseLocation";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private LocationManager locationManager;
    private LocationListener activeListener;
    private Runnable timeoutTask;
    private PluginCall activeCall;

    @PluginMethod
    public void getCurrentPosition(PluginCall call) {
        if (activeCall != null) {
            call.reject("A location request is already in progress");
            return;
        }

        if (!hasLocationPermission()) {
            call.reject("Location permission is required");
            return;
        }

        locate(call);
    }

    private boolean hasLocationPermission() {
        return (
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        );
    }

    private void locate(PluginCall call) {
        try {
            locationManager = (LocationManager) getContext().getSystemService(android.content.Context.LOCATION_SERVICE);
            if (locationManager == null) {
                call.reject("Location service is unavailable");
                return;
            }

            String provider = selectProvider();
            if (provider == null) {
                call.reject("Location services are disabled");
                return;
            }

            int maximumAge = Math.max(0, call.getInt("maximumAge", 60_000));
            Location cachedLocation = getBestLastKnownLocation(maximumAge);
            if (cachedLocation != null) {
                call.resolve(toPosition(cachedLocation));
                return;
            }

            activeCall = call;
            activeListener = new LocationListener() {
                @Override
                public void onLocationChanged(Location location) {
                    resolveLocation(location);
                }

                @Override
                public void onStatusChanged(String provider, int status, Bundle extras) {}

                @Override
                public void onProviderEnabled(String provider) {}

                @Override
                public void onProviderDisabled(String provider) {}
            };

            int timeout = Math.max(1_000, call.getInt("timeout", 20_000));
            timeoutTask = () -> rejectActiveCall("Unable to retrieve location in time");
            handler.postDelayed(timeoutTask, timeout);
            locationManager.requestSingleUpdate(provider, activeListener, Looper.getMainLooper());
        } catch (SecurityException error) {
            cleanup();
            call.reject("Location permission is unavailable", error);
        } catch (RuntimeException error) {
            cleanup();
            call.reject("Unable to retrieve the current location", error);
        }
    }

    private String selectProvider() {
        boolean hasFinePermission =
            ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;

        if (hasFinePermission && isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            return LocationManager.GPS_PROVIDER;
        }
        if (isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
            return LocationManager.NETWORK_PROVIDER;
        }
        if (isProviderEnabled(LocationManager.PASSIVE_PROVIDER)) {
            return LocationManager.PASSIVE_PROVIDER;
        }
        return null;
    }

    private boolean isProviderEnabled(String provider) {
        try {
            return locationManager.isProviderEnabled(provider);
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    @SuppressWarnings("MissingPermission")
    private Location getBestLastKnownLocation(int maximumAge) {
        Location best = null;
        long oldestAcceptedTime = System.currentTimeMillis() - maximumAge;

        try {
            List<String> providers = locationManager.getProviders(true);
            for (String provider : providers) {
                Location candidate = locationManager.getLastKnownLocation(provider);
                if (
                    candidate != null &&
                    candidate.getTime() >= oldestAcceptedTime &&
                    (best == null || candidate.getTime() > best.getTime())
                ) {
                    best = candidate;
                }
            }
        } catch (SecurityException ignored) {
            return null;
        } catch (RuntimeException ignored) {
            return null;
        }

        return best;
    }

    private void resolveLocation(Location location) {
        PluginCall call = activeCall;
        cleanup();
        if (call != null && location != null) {
            call.resolve(toPosition(location));
        } else if (call != null) {
            call.reject("Location is unavailable");
        }
    }

    private void rejectActiveCall(String message) {
        PluginCall call = activeCall;
        cleanup();
        if (call != null) call.reject(message);
    }

    private JSObject toPosition(Location location) {
        JSObject coordinates = new JSObject();
        coordinates.put("latitude", location.getLatitude());
        coordinates.put("longitude", location.getLongitude());
        coordinates.put("accuracy", location.hasAccuracy() ? location.getAccuracy() : null);

        JSObject position = new JSObject();
        position.put("timestamp", location.getTime());
        position.put("coords", coordinates);
        return position;
    }

    private void cleanup() {
        if (timeoutTask != null) {
            handler.removeCallbacks(timeoutTask);
            timeoutTask = null;
        }
        if (locationManager != null && activeListener != null) {
            try {
                locationManager.removeUpdates(activeListener);
            } catch (RuntimeException ignored) {}
        }
        activeListener = null;
        activeCall = null;
    }

    @Override
    protected void handleOnDestroy() {
        cleanup();
        super.handleOnDestroy();
    }
}
