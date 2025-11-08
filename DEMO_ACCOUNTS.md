# Demo Accounts & Employee Features

## 🔐 Demo Login Credentials

The login page now displays demo credentials that you can click to auto-fill:

### Admin Account
- **Email:** `admin@demo.com`
- **Password:** `demo123`
- **Access:** Full access to all features
- **Features:** All 14 modules

### Employee Account
- **Email:** `employee@demo.com`
- **Password:** `demo123`
- **Access:** Limited to employee-specific features
- **Features:** 10 employee modules

---

## 📋 Employee Menu (What Employees See)

When an employee logs in, they have access to these modules:

### ✅ **Accessible Modules (10 total)**

1. **📊 Dashboard** (Blue)
   - Personal stats overview
   - Attendance summary
   - Quick actions
   - Upcoming events

2. **👤 My Profile** (Violet)
   - Personal information
   - Contact details
   - Documents
   - Emergency contacts

3. **✅ Tasks** (Purple)
   - My assigned tasks
   - Task status updates
   - GitHub integration
   - Deadline tracking

4. **🕐 Attendance** (Amber)
   - Mark attendance with GPS
   - View attendance history
   - Check-in/Check-out
   - Location tracking

5. **📅 Leave** (Teal)
   - Apply for leave
   - View leave balance
   - Leave history
   - Approval status

6. **💰 Expenses** (Orange)
   - Submit expense claims
   - Upload receipts
   - Track reimbursements
   - Expense history

7. **🎯 Performance** (Yellow)
   - View performance goals
   - Self-assessment
   - Manager feedback
   - KPI tracking

8. **📚 Training** (Green)
   - Enrolled courses
   - Training schedule
   - Certifications
   - Learning progress

9. **🎧 Helpdesk** (Pink)
   - Raise IT tickets
   - HR support requests
   - Ticket status
   - Support history

10. **📢 Announcements** (Fuchsia)
    - Company news
    - Important updates
    - Event notifications
    - Policy changes

---

### ❌ **Restricted Modules (Not visible to employees)**

1. **👥 Employees** - Admin/HR/Manager only
2. **💵 Payroll** - Admin/HR/Finance only
3. **📊 Reports** - Admin/HR/Finance only
4. **⚙️ Settings** - Admin/HR only

---

## 🎨 Employee Dashboard Features

### Quick Actions Available
- ⏰ Mark Attendance (with GPS)
- 📝 Apply Leave
- 💼 View Payslip
- 💰 Submit Expense

### Personal Stats Displayed
- Attendance percentage
- Leave balance
- Pending tasks
- Performance rating

### Upcoming Events
- Team meetings
- Training sessions
- Performance reviews
- Company events

---

## 🔒 Security & Permissions

### Employee Role Limitations

**Can Do:**
- ✅ View own data
- ✅ Update personal profile
- ✅ Submit requests (leave, expense, helpdesk)
- ✅ Mark own attendance
- ✅ View assigned tasks
- ✅ Access training materials
- ✅ Read announcements

**Cannot Do:**
- ❌ View other employees' data
- ❌ Process payroll
- ❌ Approve leave/expenses
- ❌ Add/remove employees
- ❌ Access system settings
- ❌ Generate reports
- ❌ Manage master data

---

## 🚀 How to Test Employee Access

### Method 1: Use Demo Credentials (Recommended)
1. Go to login page
2. Click on "**Employee**" demo account box
3. Credentials auto-fill
4. Click "Sign In"
5. You'll see the employee-only menu

### Method 2: Create New Employee Account
1. Admin creates employee in "Employees" module
2. Employee receives invitation email
3. Employee registers using invitation link
4. Auto-assigned "employee" role
5. Limited menu based on role

---

## 📊 Feature Comparison

| Feature | Admin | HR | Manager | Employee |
|---------|-------|----|---------| ---------|
| Dashboard | ✅ | ✅ | ✅ | ✅ (Personal) |
| My Profile | ✅ | ✅ | ✅ | ✅ |
| Tasks | ✅ | ✅ | ✅ | ✅ (Assigned) |
| Employees | ✅ | ✅ | ✅ | ❌ |
| Attendance | ✅ | ✅ | ✅ | ✅ (Own) |
| Leave | ✅ | ✅ | ✅ | ✅ (Own) |
| Expenses | ✅ | ✅ | ✅ | ✅ (Own) |
| Payroll | ✅ | ✅ | ✅ (View) | ❌ |
| Performance | ✅ | ✅ | ✅ | ✅ (Own) |
| Training | ✅ | ✅ | ✅ | ✅ |
| Helpdesk | ✅ | ✅ | ✅ | ✅ |
| Announcements | ✅ | ✅ | ✅ | ✅ |
| Reports | ✅ | ✅ | ✅ (Limited) | ❌ |
| Settings | ✅ | ✅ | ❌ | ❌ |

---

## 🎯 Employee Self-Service Features

### Attendance Management
- GPS-based check-in/out
- View attendance history
- Track work hours
- Location verification

### Leave Management
- Check leave balance
- Apply for various leave types
- View approval status
- Download leave reports

### Expense Claims
- Submit multi-item expenses
- Upload receipts
- Track reimbursement status
- View expense history

### Performance Tracking
- View goals and KPIs
- Self-assessment forms
- 360° feedback participation
- Performance history

### Training & Development
- Access course materials
- Track learning progress
- Download certificates
- Request new trainings

---

## 💡 Notes

1. **Role-Based Access Control (RBAC)** is enforced at:
   - Frontend: Menu visibility
   - Backend: RLS policies
   - Database: Row-level security

2. **Data Isolation**: Employees can only see their own data unless shared organization-wide (like announcements)

3. **Automatic Role Assignment**: When employees register via invitation, they're automatically assigned the "employee" role

4. **Responsive Design**: All employee features work seamlessly on mobile devices for on-the-go access

---

## 🔧 Setup Instructions for New Demo Employee

To create additional employee demo accounts:

1. Login as Admin
2. Go to "Employees" → "Add Employee"
3. Fill in employee details
4. System generates invitation link
5. Employee uses link to register
6. Auto-assigned "employee" role
7. Limited access automatically applied

---

**Last Updated:** October 31, 2024
**Version:** 1.0
**Status:** Production Ready ✅
