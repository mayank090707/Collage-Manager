import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { ThemeProvider } from "next-themes";
import { router } from "./routes";
import { Toaster } from "./components/ui/sonner";
import { api } from "../lib/api";

export default function App() {
  useEffect(() => {
    const initApp = async () => {
      // 1. Check if we need to migrate local data to DB
      const hasLocalData = localStorage.getItem('student_profile');
      if (hasLocalData) {
        await api.migrateLocalStorageToDB();
      }
      
      // 2. Sync fresh data from DB
      await api.syncFromDB();
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
