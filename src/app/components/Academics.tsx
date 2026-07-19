import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { AttendanceTab } from "./academics/AttendanceTab";
import { SGPATab } from "./academics/SGPATab";
import { CGPATab } from "./academics/CGPATab";
import { BacklogsTab } from "./academics/BacklogsTab";

export function Academics() {
  const [activeTab, setActiveTab] = useState("attendance");

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-4xl mb-2 bg-gradient-to-r from-[var(--brand-start)] via-white to-[var(--brand-end)] bg-clip-text text-transparent">
          Academics
        </h1>
        <p className="text-gray-400 text-lg">
          Manage your academic records and performance
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[#111118]/80 border border-gray-800/50 p-1 h-auto">
          <TabsTrigger
            value="attendance"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--brand-start)]/20 data-[state=active]:to-[var(--brand-end)]/20 data-[state=active]:text-[var(--brand-start)] data-[state=active]:shadow-[0_0_10px_rgba(var(--brand-start-rgb), 0.2)] text-gray-400"
          >
            Attendance
          </TabsTrigger>
          <TabsTrigger
            value="sgpa"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--brand-start)]/20 data-[state=active]:to-[var(--brand-end)]/20 data-[state=active]:text-[var(--brand-start)] data-[state=active]:shadow-[0_0_10px_rgba(var(--brand-start-rgb), 0.2)] text-gray-400"
          >
            SGPA
          </TabsTrigger>
          <TabsTrigger
            value="cgpa"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--brand-start)]/20 data-[state=active]:to-[var(--brand-end)]/20 data-[state=active]:text-[var(--brand-start)] data-[state=active]:shadow-[0_0_10px_rgba(var(--brand-start-rgb), 0.2)] text-gray-400"
          >
            CGPA
          </TabsTrigger>
          <TabsTrigger
            value="backlogs"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[var(--brand-start)]/20 data-[state=active]:to-[var(--brand-end)]/20 data-[state=active]:text-[var(--brand-start)] data-[state=active]:shadow-[0_0_10px_rgba(var(--brand-start-rgb), 0.2)] text-gray-400"
          >
            Backlogs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          <AttendanceTab />
        </TabsContent>

        <TabsContent value="sgpa">
          <SGPATab />
        </TabsContent>

        <TabsContent value="cgpa">
          <CGPATab />
        </TabsContent>

        <TabsContent value="backlogs">
          <BacklogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
