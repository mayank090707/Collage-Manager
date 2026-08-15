import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { GraduationCap, Sparkles, Loader2, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { logActivity } from "../../lib/activityTracker";

export function LoginScreen() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    // Check if user session is valid (30-day default persistent session)
    const savedUserId = localStorage.getItem("college_manager_user_id");
    const expiryStr = localStorage.getItem("college_manager_remember_expiry");

    if (savedUserId) {
      const isNotExpired = !expiryStr || Date.now() < parseInt(expiryStr, 10);
      if (isNotExpired) {
        // Active session — auto-login & sync DB data
        api.syncFromDB().then(() => {
          const userRole = localStorage.getItem("user_role");
          if (userRole === "admin" || savedUserId === "usr-admin") {
            navigate("/app/admin");
          } else {
            navigate("/app");
          }
        });
      } else {
        // Expired after 30 days — clear saved session so user must log in again
        localStorage.removeItem("college_manager_user_id");
        localStorage.removeItem("college_manager_remember");
        localStorage.removeItem("college_manager_remember_expiry");
      }
    }
  }, []);

  const validatePassword = (pass: string) => {
    const hasCapital = /[A-Z]/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    return hasCapital && hasSpecial;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLogin) {
      if (password !== confirmPassword) {
        toast.error("Passwords do not match!");
        return;
      }
      if (!validatePassword(password)) {
        toast.error("Password must contain at least 1 uppercase letter and 1 special character.");
        return;
      }
    }

    setIsLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      if (isLogin) {
        // 1. Direct Admin Credential Check (handled by server too, but fast-path here)
        if (cleanEmail === "admin@campus-hub.com" && password.trim() === "AdminPassword123") {
          toast.success("Welcome Super Admin!");
          localStorage.setItem("user_role", "admin");
          localStorage.setItem("college_manager_user_id", "usr-admin");
          localStorage.setItem("onboarding_complete", "true");
          localStorage.setItem(
            "student_profile",
            JSON.stringify({
              fullName: "Mayank",
              enrollmentNumber: "0000000000",
              email: "admin@campus-hub.com",
              collegeName: "GGSIPU Main Campus",
              course: "Administration",
              branch: "Admin",
              designation: "Admin",
              currentSemester: "N/A",
              admissionYear: "2023",
              graduationYear: "2027",
            })
          );
          logActivity("ADMIN_LOGIN_SUCCESS", "Super Admin authenticated.", "System", "admin@campus-hub.com", "Mayank", "warning");
          navigate("/app/admin");
          return;
        }

        // 2. Standard backend API login
        const result = await api.login({ email: cleanEmail, password });

        // Handle admin returning from server
        if (result.role === "admin" || result.userId === "usr-admin") {
          toast.success("Welcome Super Admin!");
          localStorage.setItem("user_role", "admin");
          localStorage.setItem("college_manager_user_id", "usr-admin");
          localStorage.setItem("onboarding_complete", "true");
          localStorage.setItem(
            "student_profile",
            JSON.stringify({
              fullName: "Mayank",
              enrollmentNumber: "0000000000",
              email: "admin@campus-hub.com",
              collegeName: "GGSIPU Main Campus",
              course: "Administration",
              branch: "Admin",
              designation: "Admin",
              currentSemester: "N/A",
              admissionYear: "2023",
              graduationYear: "2027",
            })
          );
          logActivity("ADMIN_LOGIN_SUCCESS", "Super Admin authenticated via server.", "System", "admin@campus-hub.com", "Mayank", "warning");
          navigate("/app/admin");
          return;
        }

        // Set session
        localStorage.setItem("college_manager_user_id", result.userId);
        localStorage.setItem("user_role", "student");
        localStorage.setItem("college_manager_remember", rememberMe.toString());
        localStorage.setItem("college_manager_remember_expiry", (Date.now() + 30 * 24 * 60 * 60 * 1000).toString());

        // Sync ALL user data from MongoDB
        const syncResult = await api.syncFromDB();

        logActivity("LOGIN_SUCCESS", `Student logged in (${cleanEmail}).`, "Login", cleanEmail, "Student User", "success");

        // Route decision — server is the single source of truth
        // syncResult.isNewUser = true  → never completed onboarding → show onboarding
        // syncResult.isOnboarded = true → completed onboarding → go to dashboard
        // syncResult = null (offline) → fall back to localStorage
        const isNewUser      = syncResult?.isNewUser === true;
        const serverOnboarded = syncResult?.isOnboarded === true;
        const localOnboarded  = localStorage.getItem("onboarding_complete") === "true";

        if (isNewUser) {
          toast.success("Account verified! Let's set up your profile.");
          navigate("/onboarding");
        } else if (serverOnboarded || localOnboarded) {
          toast.success("Welcome back!");
          navigate("/app");
        } else {
          navigate("/onboarding");
        }
        return;
      } else {
        await api.signup({ 
          email: cleanEmail, 
          password, 
          firstName, 
          lastName, 
          dob 
        });

        logActivity(
          "USER_SIGNUP",
          `New user account registered for ${firstName} ${lastName} (${cleanEmail}).`,
          "Login",
          cleanEmail,
          `${firstName} ${lastName}`,
          "success"
        );

        toast.success("Account created successfully! Please sign in.");
        setIsLogin(true); // Switch to login mode
        setPassword("");
        setConfirmPassword("");
        setFirstName("");
        setLastName("");
        setDob("");
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dark min-h-screen bg-[#0a0a0f] relative overflow-hidden flex items-center justify-center">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-[var(--brand-start)] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-[var(--brand-end)] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/3 w-96 h-96 bg-[var(--brand-start)] rounded-full mix-blend-multiply filter blur-[128px] opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#111118_1px,transparent_1px),linear-gradient(to_bottom,#111118_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>

      <div className="relative z-50 w-full max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Side - Illustration */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="hidden lg:flex flex-col items-center justify-center space-y-6"
        >
          <div className="relative">
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] rounded-full blur-3xl opacity-30"></div>
            <img src="/logo.png" alt="Campus Hub Logo" className="w-64 h-64 object-contain relative z-10 rounded-full border-4 border-gray-800/50 shadow-2xl backdrop-blur-md" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-[var(--brand-start)] via-[var(--brand-end)] to-[var(--brand-start)] bg-clip-text text-transparent">
              Campus Hub
            </h1>
            <p className="text-gray-400 text-lg">Your Academic Operating System</p>
          </div>
        </motion.div>

        {/* Right Side - Login Card */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full"
        >
          <div className="relative">
            {/* Glassmorphism Card */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-[#111118]/80 to-[#111118]/40 rounded-3xl blur-xl"></div>
            <div className="relative backdrop-blur-xl bg-[#111118]/60 border border-gray-800/50 rounded-3xl p-8 shadow-2xl">
              {/* Neon Border Effect */}
              <div className="absolute inset-0 pointer-events-none rounded-3xl bg-gradient-to-r from-[var(--brand-start)]/20 via-[var(--brand-end)]/20 to-[var(--brand-start)]/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>

              {/* Logo */}
              <div className="flex items-center justify-center mb-8">
                <div className="flex items-center space-x-3">
                  <img src="/logo.png" alt="Campus Hub Logo" className="w-10 h-10 object-contain rounded-full border border-gray-800/40" />
                  <span className="text-2xl font-bold bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] bg-clip-text text-transparent">
                    Campus Hub
                  </span>
                </div>
              </div>

              <h2 className="text-2xl mb-2 text-center text-white">
                {isLogin ? "Welcome Back" : "Create Account"}
              </h2>
              <p className="text-gray-400 text-center mb-6">
                {isLogin ? "Sign in to your academic portal" : "Join the modern academic ecosystem"}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-gray-300">First Name</Label>
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] text-white h-11"
                        placeholder="John"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-gray-300">Last Name</Label>
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] text-white h-11"
                        placeholder="Doe"
                        required
                      />
                    </div>
                  </div>
                )}

                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="dob" className="text-gray-300">Date of Birth</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] text-white h-11"
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-300">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] transition-colors text-white h-11"
                    placeholder="eg- student@college.edu"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-300">
                      Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] transition-colors text-white h-11 pr-10"
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {!isLogin && (
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-gray-300">
                        Confirm Password
                      </Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="bg-[#0a0a0f]/50 border-gray-700 focus:border-[var(--brand-start)] transition-colors text-white h-11 pr-10"
                          placeholder="••••••••"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  {isLogin && (
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="remember" 
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                        className="border-gray-600 data-[state=checked]:bg-[var(--brand-start)] data-[state=checked]:border-[var(--brand-start)]"
                      />
                      <Label htmlFor="remember" className="text-sm text-gray-400 cursor-pointer">
                        Remember me
                      </Label>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-[var(--brand-start)] hover:bg-amber-600 text-white font-semibold rounded-lg shadow-[0_0_20px_rgba(var(--brand-start-rgb), 0.3)] hover:shadow-[0_0_30px_rgba(var(--brand-start-rgb), 0.5)] transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    isLogin ? "Sign In" : "Create Account"
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-[#111118]/60 text-gray-400">OR</span>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  variant="outline"
                  className="w-full h-12 border-gray-700 hover:border-[var(--brand-end)] bg-transparent text-white hover:bg-[var(--brand-end)]/10 transition-all"
                >
                  {isLogin ? "Create New Account" : "Back to Sign In"}
                </Button>
              </form>
            </div>
          </div>
        </motion.div>
      </div>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
