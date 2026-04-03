import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";
import { HomePage } from "./pages/HomePage";
import { FoodAndDrinkPage } from "./pages/food-and-drink-page";
import { FoodAndDrinkDetailPage } from "./pages/food-and-drink-detail-page";
import { EventsPage } from "./pages/EventsPage";
import { ClubsPage } from "./pages/ClubsPage";
import { ConcertsPage } from "./pages/ConcertsPage";
import { TheatrePage } from "./pages/TheatrePage";
import { CinemaPage } from "./pages/CinemaPage";
import { AddVenuePage } from "./pages/AddVenuePage";
import { AdminPage } from "./pages/AdminPage";
import { MyPanelPage } from "./pages/MyPanelPage";
import { MapPage } from "./pages/MapPage";
import { SubmitEventPage } from "./pages/SubmitEventPage";
import { ContactPage } from "./pages/ContactPage";
import LoginPage from "./pages/LoginPage";

// View All Pages
import { EventsAllPage } from "./pages/EventsAllPage";
import { TheatreAllPage } from "./pages/TheatreAllPage";
import { CinemaAllPage } from "./pages/CinemaAllPage";
import { ClubsAllPage } from "./pages/ClubsAllPage";
import { ConcertsAllPage } from "./pages/ConcertsAllPage";

// Detail Pages
import { EventDetailPage } from "./pages/EventDetailPage";
import { ClubDetailPage } from "./pages/ClubDetailPage";
import { SearchResultsPage } from "./pages/SearchResultsPage";
import { TermsOfServicePage } from "./pages/TermsOfServicePage";
import { PrivacyPolicyPage } from "./pages/PrivacyPolicyPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootLayout,
    children: [
      {
        index: true,
        Component: HomePage,
      },
      {
        path: "food-and-drink",
        Component: FoodAndDrinkPage,
      },
      {
        path: "food-and-drink/:id",
        Component: FoodAndDrinkDetailPage,
      },
      {
        path: "events",
        Component: EventsPage,
      },
      {
        path: "events/all",
        Component: EventsAllPage,
      },
      {
        path: "events/:id",
        Component: EventDetailPage,
      },
      {
        path: "clubs",
        Component: ClubsPage,
      },
      {
        path: "clubs/all",
        Component: ClubsAllPage,
      },
      {
        path: "clubs/:id",
        Component: ClubDetailPage,
      },
      {
        path: "concerts",
        Component: ConcertsPage,
      },
      {
        path: "concerts/all",
        Component: ConcertsAllPage,
      },
      {
        path: "concerts/:id",
        Component: EventDetailPage,
      },
      {
        path: "theatre",
        Component: TheatrePage,
      },
      {
        path: "theatre/all",
        Component: TheatreAllPage,
      },
      {
        path: "theatre/:id",
        Component: EventDetailPage,
      },
      {
        path: "cinema",
        Component: CinemaPage,
      },
      {
        path: "cinema/all",
        Component: CinemaAllPage,
      },
      {
        path: "cinema/:id",
        Component: EventDetailPage,
      },
      {
        path: "admin",
        Component: AdminPage,
      },
      {
        path: "add-venue",
        Component: AddVenuePage,
      },
      {
        path: "add-venue/:id",
        Component: AddVenuePage,
      },
      {
        path: "map",
        Component: MapPage,
      },
      {
        path: "submit-event",
        Component: SubmitEventPage,
      },
      {
        path: "submit-event/:id",
        Component: SubmitEventPage,
      },
      {
        path: "contact",
        Component: ContactPage,
      },
      {
        path: "search",
        Component: SearchResultsPage,
      },
      {
        path: "privacyPolicy",
        Component: PrivacyPolicyPage,
      },
      {
        path: "legalNotice",
        Component: ContactPage,
      },
      {
        path: "termsOfService",
        Component: TermsOfServicePage,
      },
      {
        path: "login",
        Component: LoginPage,
      },
      {
        path: "signup",
        Component: LoginPage, // Isti redirect kao login — otvara auth modal
      },
      {
        path: "my-panel",
        Component: MyPanelPage,
      },
      {
        path: "*",
        Component: HomePage,
      },
    ],
  },
]);