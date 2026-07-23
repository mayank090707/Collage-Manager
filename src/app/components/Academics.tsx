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
        <h1 className="text-3xl md:text-4xl font-black text-foreground mb-2">
          Academics
        </h1>
        <p className="text-muted-foreground text-lg">
          Manage your academic records and performance
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted border border-border p-1.5 h-auto rounded-xl flex gap-1">
          <TabsTrigger
            value="attendance"
            className="data-[state=active]:bg-card data-[state=active]:text-[var(--brand-start)] data-[state=active]:shadow-sm text-muted-foreground font-bold px-5 py-2.5 rounded-lg transition-all"
          >
            Attendance
          </TabsTrigger>
          <TabsTrigger
            value="sgpa"
            className="data-[state=active]:bg-card data-[state=active]:text-[var(--brand-start)] data-[state=active]:shadow-sm text-muted-foreground font-bold px-5 py-2.5 rounded-lg transition-all"
          >
            SGPA
          </TabsTrigger>
          <TabsTrigger
            value="cgpa"
            className="data-[state=active]:bg-card data-[state=active]:text-[var(--brand-start)] data-[state=active]:shadow-sm text-muted-foreground font-bold px-5 py-2.5 rounded-lg transition-all"
          >
            CGPA
          </TabsTrigger>
          <TabsTrigger
            value="backlogs"
            className="data-[state=active]:bg-card data-[state=active]:text-[var(--brand-start)] data-[state=active]:shadow-sm text-muted-foreground font-bold px-5 py-2.5 rounded-lg transition-all"
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
