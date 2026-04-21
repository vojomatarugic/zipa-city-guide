import { Link, useNavigate } from "react-router";
import { useT } from "../hooks/useT";
import {
  BACKGROUNDS,
  BORDERS,
  TEXT,
  BRAND,
  GRADIENTS,
  getGradientTextStyle,
} from "../utils/colors";
import { Plus } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function Footer() {
  const { t } = useT();
  const navigate = useNavigate();
  const { isLoggedIn, isAdmin, openAuthModal, logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <footer
      className="w-full"
      style={{
        background: BACKGROUNDS.gray,
        borderTop: `1px solid ${BORDERS.medium}`,
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          paddingLeft: "16px",
          paddingRight: "16px",
          paddingTop: "20px",
          paddingBottom: "32px",
        }}
      >
        {/* Links Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 items-start">
          {/* COLUMN 1: Explore */}
          <div className="flex flex-col">
            <h4
              className="mb-1.5 sm:mb-3"
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: BRAND.primary,
              }}
            >
              {t("explore")}
            </h4>
            <div className="flex flex-col gap-0 sm:gap-3">
              <Link
                to="/food-and-drink"
                className="no-underline hover:underline transition-colors"
                style={{
                  fontSize: "14px",
                  color: TEXT.secondary,
                  fontWeight: 400,
                  lineHeight: "1.1",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = BRAND.primary)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = TEXT.secondary)
                }
              >
                {t("foodAndDrink")}
              </Link>
              <Link
                to="/events"
                className="no-underline hover:underline transition-colors"
                style={{
                  fontSize: "14px",
                  color: TEXT.secondary,
                  fontWeight: 400,
                  lineHeight: "1.1",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = BRAND.primary)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = TEXT.secondary)
                }
              >
                {t("events")}
              </Link>
              <Link
                to="/theatre"
                className="no-underline hover:underline transition-colors"
                style={{
                  fontSize: "14px",
                  color: TEXT.secondary,
                  fontWeight: 400,
                  lineHeight: "1.1",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = BRAND.primary)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = TEXT.secondary)
                }
              >
                {t("theatre")}
              </Link>
              <Link
                to="/cinema"
                className="no-underline hover:underline transition-colors"
                style={{
                  fontSize: "14px",
                  color: TEXT.secondary,
                  fontWeight: 400,
                  lineHeight: "1.1",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = BRAND.primary)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = TEXT.secondary)
                }
              >
                {t("cinema")}
              </Link>
              <Link
                to="/clubs"
                className="no-underline hover:underline transition-colors"
                style={{
                  fontSize: "14px",
                  color: TEXT.secondary,
                  fontWeight: 400,
                  lineHeight: "1.1",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = BRAND.primary)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = TEXT.secondary)
                }
              >
                {t("clubs")}
              </Link>
              <Link
                to="/concerts"
                className="no-underline hover:underline transition-colors"
                style={{
                  fontSize: "14px",
                  color: TEXT.secondary,
                  fontWeight: 400,
                  lineHeight: "1.1",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = BRAND.primary)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = TEXT.secondary)
                }
              >
                {t("concerts")}
              </Link>
            </div>
          </div>

          {/* COLUMN 2: About */}
          <div>
            <h4
              className="mb-1.5 sm:mb-3"
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: BRAND.primary,
              }}
            >
              {t("about")}
            </h4>
            <div className="flex flex-col gap-0 sm:gap-3">
              <Link
                to="/contact"
                className="no-underline hover:underline transition-colors"
                style={{
                  fontSize: "14px",
                  color: TEXT.secondary,
                  fontWeight: 400,
                  lineHeight: "1.1",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = BRAND.primary)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = TEXT.secondary)
                }
              >
                {t("contact")}
              </Link>
              <Link
                to="/privacyPolicy"
                className="no-underline hover:underline transition-colors"
                style={{
                  fontSize: "14px",
                  color: TEXT.secondary,
                  fontWeight: 400,
                  lineHeight: "1.1",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = BRAND.primary)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = TEXT.secondary)
                }
              >
                {t("privacyPolicy")}
              </Link>
              <Link
                to="/termsOfService"
                className="no-underline hover:underline transition-colors"
                style={{
                  fontSize: "14px",
                  color: TEXT.secondary,
                  fontWeight: 400,
                  lineHeight: "1.1",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = BRAND.primary)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = TEXT.secondary)
                }
              >
                {t("termsOfService")}
              </Link>
            </div>
          </div>

          {/* COLUMN 3: Follow */}
          <div>
            <h4
              className="mb-1.5 sm:mb-3"
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: BRAND.primary,
              }}
            >
              {t("follow")}
            </h4>
            <div className="flex flex-col gap-0 sm:gap-3">
              <a
                href="#"
                className="no-underline hover:underline transition-colors"
                style={{
                  fontSize: "14px",
                  color: TEXT.secondary,
                  lineHeight: "1.1",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = BRAND.primary)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = TEXT.secondary)
                }
              >
                Facebook
              </a>
              <a
                href="#"
                className="no-underline hover:underline transition-colors"
                style={{
                  fontSize: "14px",
                  color: TEXT.secondary,
                  lineHeight: "1.1",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = BRAND.primary)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = TEXT.secondary)
                }
              >
                Instagram
              </a>
              <a
                href="#"
                className="no-underline hover:underline transition-colors"
                style={{
                  fontSize: "14px",
                  color: TEXT.secondary,
                  lineHeight: "1.1",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = BRAND.primary)
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = TEXT.secondary)
                }
              >
                Twitter
              </a>
            </div>
          </div>

          {/* COLUMN 4: Moj nalog - Auth Links */}
          <div className="flex flex-col">
            <h4
              className="mb-1.5 sm:mb-3"
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: BRAND.primary,
              }}
            >
              {t("myAccount")}
            </h4>
            <div className="flex flex-col gap-0 sm:gap-3">
              {!isLoggedIn ? (
                <>
                  {/* Guest - Prijava */}
                  <button
                    onClick={() => openAuthModal("login")}
                    className="no-underline hover:underline transition-colors text-left bg-transparent border-0 p-0 cursor-pointer"
                    style={{
                      fontSize: "14px",
                      color: TEXT.secondary,
                      fontWeight: 400,
                      lineHeight: "1.1",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = BRAND.primary)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = TEXT.secondary)
                    }
                  >
                    {t("login")}
                  </button>
                </>
              ) : (
                <>
                  {/* Logged In - Admin ili User Panel */}
                  <Link
                    to={isAdmin ? "/admin" : "/my-panel"}
                    className="no-underline hover:underline transition-colors"
                    style={{
                      fontSize: "14px",
                      color: TEXT.secondary,
                      fontWeight: 400,
                      lineHeight: "1.1",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = BRAND.primary)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = TEXT.secondary)
                    }
                  >
                    {isAdmin ? t("adminPanel") : t("myPanel")}
                  </Link>

                  <Link
                    to="/add-venue"
                    className="no-underline hover:underline transition-colors"
                    style={{
                      fontSize: "14px",
                      color: TEXT.secondary,
                      fontWeight: 400,
                      lineHeight: "1.1",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = BRAND.primary)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = TEXT.secondary)
                    }
                  >
                    {t("addObject")}
                  </Link>

                  <Link
                    to="/submit-event"
                    className="no-underline hover:underline transition-colors"
                    style={{
                      fontSize: "14px",
                      color: TEXT.secondary,
                      fontWeight: 400,
                      lineHeight: "1.1",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = BRAND.primary)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = TEXT.secondary)
                    }
                  >
                    {t("addEvent")}
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="no-underline hover:underline transition-colors text-left bg-transparent border-0 p-0 cursor-pointer"
                    style={{
                      fontSize: "14px",
                      color: TEXT.secondary,
                      fontWeight: 400,
                      lineHeight: "1.1",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = BRAND.primary)
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = TEXT.secondary)
                    }
                  >
                    {t("logout")}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* COLUMN 5: CTA Buttons - REMOVED (now integrated into Moj nalog) */}
        </div>
      </div>

      {/* Info Bar - Bottom */}
      <div
        className="w-full"
        style={{
          borderTop: "1px solid #CBD5E1",
        }}
      >
        <div
          style={{
            maxWidth: "1280px",
            margin: "0 auto",
            paddingLeft: "16px",
            paddingRight: "16px",
            paddingTop: "13px",
            paddingBottom: "13px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            position: "relative",
          }}
        >
          {/* Copyright - Centriran */}
          <div
            style={{
              fontSize: "13px",
              color: "#6B7280",
              textAlign: "center",
            }}
          >
            © 2026 {t("appName")}. {t("allRightsReserved")}.
          </div>
        </div>
      </div>
    </footer>
  );
}
