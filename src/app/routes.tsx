import { createBrowserRouter } from "react-router";
import { LoginScreen } from "./components/LoginScreen";
import { OnboardingFlow } from "./components/OnboardingFlow";
import { DashboardLayout } from "./components/DashboardLayout";
import { Dashboard } from "./components/Dashboard";
import { Academics } from "./components/Academics";
import { Exams } from "./components/Exams";
import { Profile } from "./components/Profile";
import { Analytics } from "./components/Analytics";
import { Timetable } from "./components/Timetable";
import { ExamCalendar } from "./components/ExamCalendar";
import { EnterMarks } from "./components/EnterMarks";
import { RequiredMarks } from "./components/RequiredMarks";
import { MarksCalculator } from "./components/MarksCalculator";
import { TargetPredictor } from "./components/TargetPredictor";
import { StudyMaterial } from "./components/StudyMaterial";
import { AdminDashboard } from "./components/AdminDashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LoginScreen />,
  },
  {
    path: "/onboarding",
    element: <OnboardingFlow />,
  },
  {
    path: "/app",
    element: <DashboardLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "academics", element: <Academics /> },
      { path: "exams", element: <Exams /> },
      { path: "exam-calendar", element: <ExamCalendar /> },
      { path: "timetable", element: <Timetable /> },
      { path: "enter-marks", element: <EnterMarks /> },
      { path: "required-marks", element: <RequiredMarks /> },
      { path: "marks-calculator", element: <MarksCalculator /> },
      { path: "target-predictor", element: <TargetPredictor /> },
      { path: "study-material", element: <StudyMaterial /> },
      { path: "profile", element: <Profile /> },
      { path: "analytics", element: <Analytics /> },
      { path: "admin", element: <AdminDashboard /> },
    ],
  },
]);
