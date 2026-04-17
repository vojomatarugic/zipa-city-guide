import { lazy } from "react";
import { createBrowserRouter } from "react-router";
import { RootLayout } from "./components/RootLayout";

const HomePage = lazy(() => import("./pages/HomePage").then((m) => ({ default: m.HomePage })));
const FoodAndDrinkPage = lazy(() => import("./pages/FoodAndDrinkPage").then((m) => ({ default: m.FoodAndDrinkPage })));
const FoodAndDrinkDetailPage = lazy(() => import("./pages/FoodAndDrinkDetailPage").then((m) => ({ default: m.FoodAndDrinkDetailPage })));
const EventsPage = lazy(() => import("./pages/EventsPage").then((m) => ({ default: m.EventsPage })));
const ClubsPage = lazy(() => import("./pages/ClubsPage").then((m) => ({ default: m.ClubsPage })));
const ConcertsPage = lazy(() => import("./pages/ConcertsPage").then((m) => ({ default: m.ConcertsPage })));
const TheatrePage = lazy(() => import("./pages/TheatrePage").then((m) => ({ default: m.TheatrePage })));
const CinemaPage = lazy(() => import("./pages/CinemaPage").then((m) => ({ default: m.CinemaPage })));
const AddVenuePage = lazy(() => import("./pages/AddVenuePage").then((m) => ({ default: m.AddVenuePage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then((m) => ({ default: m.AdminPage })));
const MyPanelPage = lazy(() => import("./pages/MyPanelPage").then((m) => ({ default: m.MyPanelPage })));
const MapPage = lazy(() => import("./pages/MapPage").then((m) => ({ default: m.MapPage })));
const SubmitEventPage = lazy(() => import("./pages/SubmitEventPage").then((m) => ({ default: m.SubmitEventPage })));
const ContactPage = lazy(() => import("./pages/ContactPage").then((m) => ({ default: m.ContactPage })));
const LoginPage = lazy(() => import("./pages/LoginPage"));

const EventsAllPage = lazy(() => import("./pages/EventsAllPage").then((m) => ({ default: m.EventsAllPage })));
const TheatreAllPage = lazy(() => import("./pages/TheatreAllPage").then((m) => ({ default: m.TheatreAllPage })));
const CinemaAllPage = lazy(() => import("./pages/CinemaAllPage").then((m) => ({ default: m.CinemaAllPage })));
const ClubsAllPage = lazy(() => import("./pages/ClubsAllPage").then((m) => ({ default: m.ClubsAllPage })));
const ConcertsAllPage = lazy(() => import("./pages/ConcertsAllPage").then((m) => ({ default: m.ConcertsAllPage })));

const EventDetailPage = lazy(() => import("./pages/EventDetailPage").then((m) => ({ default: m.EventDetailPage })));
const ClubDetailPage = lazy(() => import("./pages/ClubDetailPage").then((m) => ({ default: m.ClubDetailPage })));
const SearchResultsPage = lazy(() => import("./pages/SearchResultsPage").then((m) => ({ default: m.SearchResultsPage })));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage").then((m) => ({ default: m.TermsOfServicePage })));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage").then((m) => ({ default: m.PrivacyPolicyPage })));

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
        path: "politika-privatnosti",
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
        path: "uslovi-koristenja",
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