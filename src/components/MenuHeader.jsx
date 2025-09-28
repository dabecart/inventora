import { useState, useRef, useEffect } from "react";
import { LogIn, LogOut, User, UploadCloud } from "lucide-react";
import IconButton from "./IconButton";

export default function MenuHeader({ signedIn, userId, status, manualPush, localPendingActions, handleAuthButton }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="flex items-center justify-between my-4 px-2 sm:px-4 relative">
      {/* Left */}
      <div className="flex items-center gap-4">
        <h1
          className="text-2xl font-bold"
          title="Manage your inventory cleanly"
        >
          Inventora
        </h1>
      </div>

      {/* Right buttons */}
      <div className="flex items-center gap-2">
        {/* Push button */}
        {(localPendingActions.current || []).length === 0 ? (
          <IconButton
            title="Nothing to push"
            className="bg-gray-600 text-white"
            disabled
          >
            <UploadCloud />
          </IconButton>
        ) : (
          <IconButton
            title="Push pending"
            onClick={manualPush}
            className="bg-green-600 text-white relative animate-pulse-glow"
            style={{"--pulse-glow-color": "34,197,94"}}
          >
            <UploadCloud />
          </IconButton>
        )}

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          {signedIn ? (
            <IconButton
              title="User menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="text-white bg-sky-600 relative"
            >
              <User />
            </IconButton>
          ) : (
            <IconButton
              title="Log in"
              onClick={() => setMenuOpen((o) => !o)}
              className={"text-white bg-gray-700 relative animate-pulse-glow"}
              style={{"--pulse-glow-color": "59,130,246"}}
            >
              <User />
            </IconButton>
          )}

          {menuOpen && (
            <div className="absolute right-0 mt-2 max-w-[80vw] sm:max-w-[33vw] bg-white rounded-xl shadow-lg ring-1 ring-black/10 z-50">
              <div className="p-3 text-sm text-gray-700">
                {signedIn ? (
                  <>
                    <p className="font-medium truncate">
                      User: {userId || "(anonymous)"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Status: {status}
                    </p>
                    <button
                      onClick={() => {
                        handleAuthButton();
                        setMenuOpen(false);
                      }}
                      className="mt-3 w-full rounded-lg bg-red-600 text-white px-3 py-2 text-sm hover:bg-red-700"
                    >
                      <div className="flex items-center justify-center gap-2 text-nowrap">
                        <LogOut size={16} />
                        Log out
                      </div>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      handleAuthButton();
                      setMenuOpen(false);
                    }}
                    className="w-full rounded-lg bg-blue-600 text-white px-3 py-2 text-sm hover:bg-blue-700"
                  >
                    <div className="flex items-center justify-center gap-2 text-nowrap">
                      <LogIn size={16} />
                      Log in
                    </div>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}