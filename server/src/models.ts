import mongoose, { Schema, Document } from 'mongoose';

// ─── User Schema ──────────────────────────────────────────
export interface IUser extends Document {
  email: string;
  password: string;
  rawPassword?: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  lastLogin?: string;
  status: string;
}

const UserSchema = new Schema<IUser>({
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true },
  rawPassword: { type: String },
  userId:      { type: String, required: true, unique: true },
  firstName:   { type: String, default: '' },
  lastName:    { type: String, default: '' },
  dob:         { type: String, default: '' },
  lastLogin:   { type: String, default: '' },
  status:      { type: String, default: 'active' },
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

export const UserModel    = mongoose.model<IUser>('User', UserSchema);
export const UserDataModel = mongoose.model<IUserData>('UserData', UserDataSchema);
