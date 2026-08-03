import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { ThemeProvider } from "next-themes";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { api } from "../lib/api";

export default function App() {
  useEffect(() => {
    const initApp = async () => {
      // 1. Sync fresh data from DB first
      const dbData = await api.syncFromDB();
      
      // 2. Only if DB returns no profile/data and local storage has un-migrated profile data, migrate local data to DB
      if (!dbData?.profile && localStorage.getItem('student_profile')) {
        await api.migrateLocalStorageToDB();
      }
    };

    initApp();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  );
}
