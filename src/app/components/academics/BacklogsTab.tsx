import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";
import { AlertCircle, CheckCircle, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";

interface Backlog {
  id: string;
  subjectName: string;
  subjectCode: string;
  semester: number;
  status: "active" | "registered" | "cleared";
  registrationDate?: string;
  clearanceDate?: string;
}

export function BacklogsTab() {
  const [backlogs, setBacklogs] = useState<Backlog[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newBacklog, setNewBacklog] = useState({
    subjectName: "",
    subjectCode: "",
    semester: "",
    status: "active" as Backlog["status"],
  });

  useEffect(() => {
    loadBacklogs();
  }, []);

  const loadBacklogs = () => {
    const saved = localStorage.getItem("backlogs");
    if (saved) {
      setBacklogs(JSON.parse(saved));
    }
  };

  const saveBacklogs = (updatedBacklogs: Backlog[]) => {
    localStorage.setItem("backlogs", JSON.stringify(updatedBacklogs));
    setBacklogs(updatedBacklogs);
  };

  const handleAddBacklog = () => {
    if (!newBacklog.subjectName || !newBacklog.subjectCode || !newBacklog.semester) {
      toast.error("Please fill in all fields");
      return;
    }

    const backlog: Backlog = {
      id: Date.now().toString(),
      subjectName: newBacklog.subjectName,
      subjectCode: newBacklog.subjectCode,
      semester: parseInt(newBacklog.semester),
      status: newBacklog.status,
      registrationDate:
        newBacklog.status === "registered" ? new Date().toISOString() : undefined,
      clearanceDate:
        newBacklog.status === "cleared" ? new Date().toISOString() : undefined,
    };

    saveBacklogs([...backlogs, backlog]);
    setShowAddDialog(false);
    setNewBacklog({
      subjectName: "",
      subjectCode: "",
      semester: "",
      status: "active",
    });
    toast.success("Backlog added successfully!");
  };

  const handleUpdateStatus = (id: string, status: Backlog["status"]) => {
    const updated = backlogs.map((b) => {
      if (b.id === id) {
        const updates: Partial<Backlog> = { status };
        if (status === "registered") {
          updates.registrationDate = new Date().toISOString();
        } else if (status === "cleared") {
          updates.clearanceDate = new Date().toISOString();
        }
        return { ...b, ...updates };
      }
      return b;
    });
    saveBacklogs(updated);
    toast.success("Status updated successfully!");
  };

  const handleDeleteBacklog = (id: string) => {
    saveBacklogs(backlogs.filter((b) => b.id !== id));
    toast.success("Backlog removed!");
  };

  const activeBacklogs = backlogs.filter((b) => b.status === "active");
  const registeredBacklogs = backlogs.filter((b) => b.status === "registered");
  const clearedBacklogs = backlogs.filter((b) => b.status === "cleared");

  const getStatusColor = (status: Backlog["status"]) => {
    switch (status) {
      case "active":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "registered":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "cleared":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    }
  };

  const getStatusIcon = (status: Backlog["status"]) => {
    switch (status) {
      case "active":
        return <AlertCircle className="w-5 h-5" />;
      case "registered":
        return <Clock className="w-5 h-5" />;
      case "cleared":
        return <CheckCircle className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-red-500/20 to-orange-500/20 border-red-500/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-red-500 to-orange-500">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-300">Active Backlogs</p>
            <p className="text-4xl text-white">{activeBacklogs.length}</p>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/20 to-yellow-500/20 border-orange-500/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500 to-yellow-500">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-300">Registered Backlogs</p>
            <p className="text-4xl text-white">{registeredBacklogs.length}</p>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-gray-300">Cleared Backlogs</p>
            <p className="text-4xl text-white">{clearedBacklogs.length}</p>
          </div>
        </Card>
      </div>

      {/* Add Backlog Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] hover:from-[#00ffff] hover:to-[#8b5cf6] text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Backlog
        </Button>
      </div>

      {/* Backlogs List */}
      <div className="space-y-6">
        {/* Active Backlogs */}
        {activeBacklogs.length > 0 && (
          <div>
            <h3 className="text-xl text-white mb-4">Active Backlogs</h3>
            <div className="grid gap-4">
              {activeBacklogs.map((backlog, index) => (
                <BacklogCard
                  key={backlog.id}
                  backlog={backlog}
                  index={index}
                  onUpdateStatus={handleUpdateStatus}
                  onDelete={handleDeleteBacklog}
                />
              ))}
            </div>
          </div>
        )}

        {/* Registered Backlogs */}
        {registeredBacklogs.length > 0 && (
          <div>
            <h3 className="text-xl text-white mb-4">Registered Backlogs</h3>
            <div className="grid gap-4">
              {registeredBacklogs.map((backlog, index) => (
                <BacklogCard
                  key={backlog.id}
                  backlog={backlog}
                  index={index}
                  onUpdateStatus={handleUpdateStatus}
                  onDelete={handleDeleteBacklog}
                />
              ))}
            </div>
          </div>
        )}

        {/* Cleared Backlogs */}
        {clearedBacklogs.length > 0 && (
          <div>
            <h3 className="text-xl text-white mb-4">Cleared Backlogs</h3>
            <div className="grid gap-4">
              {clearedBacklogs.map((backlog, index) => (
                <BacklogCard
                  key={backlog.id}
                  backlog={backlog}
                  index={index}
                  onUpdateStatus={handleUpdateStatus}
                  onDelete={handleDeleteBacklog}
                />
              ))}
            </div>
          </div>
        )}

        {backlogs.length === 0 && (
          <Card className="bg-[#111118]/80 backdrop-blur-xl border-gray-800/50 p-12 text-center">
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-xl text-white mb-2">No Backlogs!</h3>
            <p className="text-gray-400">Great job! Keep up the good work.</p>
          </Card>
        )}
      </div>

      {/* Add Backlog Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-[#111118] border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] bg-clip-text text-transparent">
              Add Backlog
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subjectName" className="text-gray-300">
                Subject Name
              </Label>
              <Input
                id="subjectName"
                value={newBacklog.subjectName}
                onChange={(e) =>
                  setNewBacklog({ ...newBacklog, subjectName: e.target.value })
                }
                className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] text-white"
                placeholder="e.g., Data Structures"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subjectCode" className="text-gray-300">
                Subject Code
              </Label>
              <Input
                id="subjectCode"
                value={newBacklog.subjectCode}
                onChange={(e) =>
                  setNewBacklog({ ...newBacklog, subjectCode: e.target.value })
                }
                className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] text-white"
                placeholder="e.g., CS201"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="semester" className="text-gray-300">
                Semester
              </Label>
              <Select
                value={newBacklog.semester}
                onValueChange={(value) =>
                  setNewBacklog({ ...newBacklog, semester: value })
                }
              >
                <SelectTrigger className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] text-white">
                  <SelectValue placeholder="Select semester" />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-gray-700 text-white">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                    <SelectItem key={sem} value={sem.toString()}>
                      Semester {sem}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="text-gray-300">
                Status
              </Label>
              <Select
                value={newBacklog.status}
                onValueChange={(value: Backlog["status"]) =>
                  setNewBacklog({ ...newBacklog, status: value })
                }
              >
                <SelectTrigger className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111118] border-gray-700 text-white">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="registered">Registered</SelectItem>
                  <SelectItem value="cleared">Cleared</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowAddDialog(false)}
                className="border-gray-700 hover:border-gray-600 bg-transparent text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddBacklog}
                className="bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] hover:from-[#00ffff] hover:to-[#8b5cf6] text-white"
              >
                Add Backlog
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface BacklogCardProps {
  backlog: Backlog;
  index: number;
  onUpdateStatus: (id: string, status: Backlog["status"]) => void;
  onDelete: (id: string) => void;
}

function BacklogCard({ backlog, index, onUpdateStatus, onDelete }: BacklogCardProps) {
  const getStatusColor = (status: Backlog["status"]) => {
    switch (status) {
      case "active":
        return "from-red-500/20 to-orange-500/20 border-red-500/30";
      case "registered":
        return "from-orange-500/20 to-yellow-500/20 border-orange-500/30";
      case "cleared":
        return "from-emerald-500/20 to-teal-500/20 border-emerald-500/30";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        className={`bg-gradient-to-br ${getStatusColor(
          backlog.status
        )} backdrop-blur-xl p-6 hover:border-opacity-60 transition-all`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h4 className="text-lg text-white">{backlog.subjectName}</h4>
              <Badge
                variant="outline"
                className={`${
                  backlog.status === "active"
                    ? "bg-red-500/20 text-red-400 border-red-500/30"
                    : backlog.status === "registered"
                    ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                    : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                }`}
              >
                {backlog.status.charAt(0).toUpperCase() + backlog.status.slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              {backlog.subjectCode} • Semester {backlog.semester}
            </p>

            <div className="flex items-center space-x-2">
              {backlog.status === "active" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => onUpdateStatus(backlog.id, "registered")}
                    className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30"
                  >
                    Mark as Registered
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onUpdateStatus(backlog.id, "cleared")}
                    className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30"
                  >
                    Mark as Cleared
                  </Button>
                </>
              )}
              {backlog.status === "registered" && (
                <Button
                  size="sm"
                  onClick={() => onUpdateStatus(backlog.id, "cleared")}
                  className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30"
                >
                  Mark as Cleared
                </Button>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(backlog.id)}
            className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
