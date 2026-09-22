import UIKit

/// Adopts the UIScene life cycle.
///
/// From the iOS 26 SDK onwards, an app linked against it that still creates its
/// window the old way is trapped at launch rather than warned: the app dies in
/// `UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption` about half a
/// second in. Building with Xcode 27 is what brought this project under that
/// rule, and version 1.10 build 1 crashed on every device running iOS 26 or
/// later.
///
/// There is nothing to do here beyond existing. `UISceneStoryboardFile` in the
/// scene manifest names Main.storyboard, so UIKit builds the window and the
/// Capacitor bridge controller from it, exactly as `UIMainStoryboardFile` did
/// before. Remove this once Capacitor is upgraded to a version that adopts
/// scenes itself.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
}
