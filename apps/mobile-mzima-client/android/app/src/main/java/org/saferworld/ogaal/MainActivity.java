package org.saferworld.ogaal;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(SafeGeolocationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
