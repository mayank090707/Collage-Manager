import mongoose, { Schema, Document } from 'mongoose';

// ─── User Schema ──────────────────────────────────────────
export interface IUser extends Document {
  email: string;
  password: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  lastLogin?: string;
  lastLoginDevice?: string;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema = new Schema<IUser>({
  email:            { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:         { type: String, required: true },
  userId:           { type: String, required: true, unique: true },
  firstName:        { type: String, default: '' },
  lastName:         { type: String, default: '' },
  dob:              { type: String, default: '' },
  lastLogin:        { type: String, default: '' },
  lastLoginDevice:  { type: String, default: '' },
  status:           { type: String, default: 'active' },
}, { timestamps: true });

// ─── UserData Schema ──────────────────────────────────────
export interface IUserData extends Document {
  userId:            string;
  profile:           any;
  subjects:          any[];
  timetable:         any[];
  attendanceRecords: any[];
  semesterData:      any[];
  semesterMarks:     any[];
  backlogs:          any[];
  examCalendar:      any;
  targetCgpa:        number;
  isOnboarded:       boolean;
  mySpaceTopics:     any[];
}

const UserDataSchema = new Schema<IUserData>({
  userId:            { type: String,               required: true, unique: true },
  profile:           { type: Schema.Types.Mixed,   default: null  },
  subjects:          { type: Schema.Types.Mixed,   default: []    },
  timetable:         { type: Schema.Types.Mixed,   default: []    },
  attendanceRecords: { type: Schema.Types.Mixed,   default: []    },
  semesterData:      { type: Schema.Types.Mixed,   default: []    },
  semesterMarks:     { type: Schema.Types.Mixed,   default: []    },
  backlogs:          { type: Schema.Types.Mixed,   default: []    },
  examCalendar:      { type: Schema.Types.Mixed,   default: null  },
  targetCgpa:        { type: Number,               default: 0     },
  isOnboarded:       { type: Boolean,              default: false },
  mySpaceTopics:     { type: Schema.Types.Mixed,   default: []    },
}, { timestamps: true });

// ─── LoginActivity Schema ─────────────────────────────────
// One record per login attempt (success OR failure)
export interface ILoginActivity extends Document {
  attemptedEmail: string;    // email submitted in the login form
  userId?: string | null;    // null for failed attempts
  success: boolean;
  timestamp: Date;
  browser: string;           // "Chrome", "Safari", "Unknown Browser"
  os: string;                // "Windows PC", "macOS", "Android", "iPhone", "Unknown OS"
  device: string;            // combined: "Windows PC / Chrome"
  userAgent: string;         // raw User-Agent header
  ipAddress?: string;        // from X-Forwarded-For or req.ip
}

const LoginActivitySchema = new Schema<ILoginActivity>({
  attemptedEmail: { type: String, required: true, lowercase: true, trim: true },
  userId:         { type: String, default: null },
  success:        { type: Boolean, required: true },
  timestamp:      { type: Date, default: Date.now, index: true },
  browser:        { type: String, default: 'Unknown Browser' },
  os:             { type: String, default: 'Unknown OS' },
  device:         { type: String, default: 'Unknown Device' },
  userAgent:      { type: String, default: '' },
  ipAddress:      { type: String, default: '' },
}, { timestamps: false });

// Index for fast per-user queries
LoginActivitySchema.index({ attemptedEmail: 1, timestamp: -1 });
LoginActivitySchema.index({ userId: 1, timestamp: -1 });

// ─── AdminConfig Schema ───────────────────────────────────
// Single document — Master Admin credentials stored in DB
export interface IAdminConfig extends Document {
  adminEmail: string;
  passwordHash: string;
  updatedAt: Date;
}

const AdminConfigSchema = new Schema<IAdminConfig>({
  adminEmail:   { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  updatedAt:    { type: Date, default: Date.now },
});

// ─── AdminAuditLog Schema ─────────────────────────────────
// Persistent audit trail for sensitive admin actions
// NEVER stores any password or password hash
export interface IAdminAuditLog extends Document {
  action: string;          // e.g. "CREDENTIAL_CHANGE", "USER_EDITED", "USER_DELETED"
  targetEmail?: string;    // which user was affected (if applicable)
  adminEmail: string;      // who performed the action
  timestamp: Date;
  device: string;          // admin's device string
  ipAddress?: string;
  details?: string;        // optional human-readable detail (no passwords)
}

const AdminAuditLogSchema = new Schema<IAdminAuditLog>({
  action:      { type: String, required: true },
  targetEmail: { type: String, default: '' },
  adminEmail:  { type: String, required: true },
  timestamp:   { type: Date, default: Date.now, index: true },
  device:      { type: String, default: 'Unknown Device' },
  ipAddress:   { type: String, default: '' },
  details:     { type: String, default: '' },
}, { timestamps: false });

AdminAuditLogSchema.index({ timestamp: -1 });

// ─── Exports ──────────────────────────────────────────────
export const UserModel          = mongoose.model<IUser>('User', UserSchema);
export const UserDataModel      = mongoose.model<IUserData>('UserData', UserDataSchema);
export const LoginActivityModel = mongoose.model<ILoginActivity>('LoginActivity', LoginActivitySchema);
export const AdminConfigModel   = mongoose.model<IAdminConfig>('AdminConfig', AdminConfigSchema);
export const AdminAuditLogModel = mongoose.model<IAdminAuditLog>('AdminAuditLog', AdminAuditLogSchema);
