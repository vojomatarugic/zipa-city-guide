import { Suspense, useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { LanguageProvider } from "./contexts/LanguageContext";
import { LocationProvider } from "./contexts/LocationContext";
import { DateFilterProvider } from "./contexts/DateFilterContext";
import { AuthProvider } from "./contexts/AuthContext";
const ogImage = "/zipa-city-guide-OG.png";
import { Toaster, toast } from "sonner@2.0.3";
import { SITE_URL } from "./config/siteConfig";

// Force rebuild after backend ?? fix
export default function App() {
  // Set meta tags for SEO and social sharing
  useEffect(() => {
    try {
      const appTitle = "Zipa City Guide";
      const appDescription = "Otkrij najbolje događaje i mjesta u svom gradu";

      // Set or update meta tags
      const setMetaTag = (
        property: string,
        content: string,
        isProperty = true,
      ) => {
        const attribute = isProperty ? "property" : "name";
        let meta = document.querySelector(
          `meta[${attribute}=\"${property}\"]`,
        ) as HTMLMetaElement;
        if (!meta) {
          meta = document.createElement("meta");
          meta.setAttribute(attribute, property);
          document.head.appendChild(meta);
        }
        meta.setAttribute("content", content);
      };

      // Primary meta tags
      setMetaTag("description", appDescription, false);
      setMetaTag(
        "keywords",
        "Zipa City Guide, turizam, restorani, noćni život, dešavanja, vodič, gradski vodič, kultura, magazin",
        false,
      );
      setMetaTag("author", "ZIPA Agency", false);

      // Open Graph / Facebook
      setMetaTag("og:type", "website");
      setMetaTag("og:url", SITE_URL + "/");
      setMetaTag("og:title", appTitle);
      setMetaTag("og:description", appDescription);
      setMetaTag("og:image", ogImage);
      setMetaTag("og:image:width", "1200");
      setMetaTag("og:image:height", "630");

      // Twitter
      setMetaTag("twitter:card", "summary_large_image");
      setMetaTag("twitter:url", SITE_URL + "/");
      setMetaTag("twitter:title", appTitle);
      setMetaTag("twitter:description", appDescription);
      setMetaTag("twitter:image", ogImage);

      // Theme color
      setMetaTag("theme-color", "#0E3DC5", false);

      // Additional iOS meta tags (favicon links live in index.html)
      setMetaTag("apple-mobile-web-app-capable", "yes", false);
      setMetaTag("apple-mobile-web-app-status-bar-style", "default", false);
      setMetaTag("apple-mobile-web-app-title", "Zipa City Guide", false);
    } catch (error) {
      console.error("Error setting meta tags:", error);
    }
  }, []);

  // Prevent stale toasts from lingering across page navigation.
  useEffect(() => {
    const unsubscribe = router.subscribe(() => {
      toast.dismiss();
    });
    return unsubscribe;
  }, []);

  return (
    <LanguageProvider>
      <LocationProvider>
        <DateFilterProvider>
          <AuthProvider>
            <Toaster
              position="top-center"
              richColors
              closeButton
              visibleToasts={1}
              toastOptions={{
                duration: 4000,
                style: {
                  fontFamily: "inherit",
                },
              }}
            />
            <Suspense
              fallback={<div className="p-4 text-center">Loading...</div>}
            >
              <RouterProvider router={router} />
            </Suspense>
          </AuthProvider>
        </DateFilterProvider>
      </LocationProvider>
    </LanguageProvider>
  );
}
