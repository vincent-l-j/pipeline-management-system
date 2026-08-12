import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import { User } from "../types";

export default function LoginPage(): React.JSX.Element {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleMicrosoftLogin = (): void => {
    // In production, this redirects to Azure AD
    window.location.href = "/api/auth/login";
  };

  const handleDevLogin = async (): Promise<void> => {
    // Development only — get a test token without Microsoft
    const { data } = await api.get<{ access_token: string; user: User }>(
      "/auth/dev-token",
    );
    login(data.access_token, data.user);
    void navigate("/");
  };

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-10 w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-navy-900 mb-2">Rozetta</h1>
        <p className="text-navy-500 mb-8">Pipeline Management System</p>

        <button
          onClick={handleMicrosoftLogin}
          className="w-full bg-navy-900 text-white py-3 px-6 rounded-lg font-medium hover:bg-navy-800 transition-colors mb-4"
          type="button"
        >
          Sign in with Microsoft
        </button>

        {(import.meta.env as Record<string, string>).VITE_ENABLE_DEV_LOGIN ===
          "true" && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-3 text-navy-400">Development</span>
              </div>
            </div>

            <button
              onClick={() => {
                void handleDevLogin();
              }}
              className="w-full border-2 border-navy-200 text-navy-600 py-3 px-6 rounded-lg font-medium hover:border-navy-400 transition-colors"
              type="button"
            >
              Dev Login (Admin)
            </button>
            <p className="text-xs text-navy-400 mt-2">
              Creates a test admin account — disabled in production
            </p>
          </>
        )}
      </div>
    </div>
  );
}
