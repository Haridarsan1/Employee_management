# Employee Access & Features Guide

## ✅ **ISSUE FIXED!**

The login page now shows **correct instructions** for testing employee access instead of fake demo credentials.

---

## 🔐 How to Create & Test Employee Account

### **Step-by-Step Process:**

#### **1. Login as Admin**
```
Use your existing admin account:
Email: info@firstmetainfra.com
Password: (your password)
```

#### **2. Navigate to Employees Module**
- Look for **"Employees"** in the left sidebar (👥 icon)
- Click to open Employees page

#### **3. Add New Employee**
- Click **"+ Add Employee"** button
- Fill in required details:
  - First Name, Last Name
  - Company Email (e.g., `john.employee@company.com`)
  - Department, Designation, Branch
  - Employment details
  - Contact information

#### **4. System Generates Invitation**
- After saving, system creates invitation link
- Copy the invitation URL
- Or resend via email if configured

#### **5. Complete Employee Registration**
- Open invitation link (use incognito/private browsing)
- Employee fills registration form
- Sets their password
- Account is created with **"employee"** role automatically

#### **6. Login as Employee**
- Go back to login page
- Use employee email and password
- **See employee-only interface!**

---

## 📱 What Employees See (10 Modules)

When logged in as employee, sidebar shows **ONLY** these:

### ✅ **Accessible Modules**

1. **📊 Dashboard**
   - Personal stats only
   - Own attendance summary
   - Assigned tasks
   - Quick actions (Mark Attendance, Apply Leave, etc.)

2. **👤 My Profile**
   - Personal information
   - Contact details
   - Bank information
   - Documents

3. **✅ Tasks**
   - Tasks assigned to them
   - Update task status
   - Add comments
   - View deadlines

4. **🕐 Attendance**
   - Mark attendance with GPS
   - View own attendance history
   - Check-in/Check-out times
   - Work hours tracking

5. **📅 Leave**
   - Apply for leave
   - Check leave balance
   - View leave history
   - Track approval status

6. **💰 Expenses**
   - Submit expense claims
   - Upload receipts
   - Track reimbursements
   - View expense history

7. **🎯 Performance**
   - View personal goals
   - Self-assessment
   - Manager feedback
   - Performance history

8. **📚 Training**
   - Enrolled courses
   - Training schedule
   - Certificates
   - Learning materials

9. **🎧 Helpdesk**
   - Raise IT tickets
   - HR support requests
   - Track ticket status
   - Support history

10. **📢 Announcements**
    - Company news
    - Important updates
    - Event notifications
    - Policy announcements

---

## 🚫 Hidden from Employees (4 Modules)

These modules are **NOT visible** to employees:

1. **👥 Employees** - Admin/HR/Manager only
2. **💵 Payroll** - Admin/HR/Finance only
3. **📊 Reports** - Admin/HR/Finance only
4. **⚙️ Settings** - Admin/HR only

---

## 🔒 Security & Data Isolation

### **What Employees CAN Do:**
- ✅ View **only their own** data
- ✅ Update personal profile
- ✅ Submit requests (leave, expense, helpdesk)
- ✅ Mark their own attendance
- ✅ Complete assigned tasks
- ✅ Read organization-wide announcements

### **What Employees CANNOT Do:**
- ❌ View other employees' information
- ❌ Access payroll data
- ❌ Approve/reject requests
- ❌ Add or remove employees
- ❌ Manage system settings
- ❌ Generate reports
- ❌ Edit master data (departments, designations)

---

## 💡 Quick Testing Tip

**Want to quickly compare?**

1. **Login as Admin** → Note all 14 modules visible
2. **Logout**
3. **Create employee account** (follow steps above)
4. **Login as Employee** → See only 10 modules
5. **Compare the difference!**

The sidebar automatically filters based on user role - no manual configuration needed!

---

## 🎨 Employee Dashboard Highlights

### **Personal Quick Actions:**
- ⏰ **Mark Attendance** - One-click GPS check-in
- 📝 **Apply Leave** - Quick leave application
- 💼 **View Payslip** - Access salary slips
- 💰 **Submit Expense** - File expense claims

### **Personal Stats:**
- Today's attendance status
- Current month attendance %
- Available leave balance
- Pending tasks count
- This month's expenses

### **Upcoming Personal Events:**
- Scheduled meetings
- Leave applications
- Training sessions
- Performance reviews
- Task deadlines

---

## 📋 Role-Based Menu System

The system uses **automatic role-based filtering**:

```javascript
// Defined in Layout.tsx
const menuItems = [
  { label: 'Dashboard', roles: ['admin', 'hr', 'finance', 'manager', 'employee'] },
  { label: 'Employees', roles: ['admin', 'hr', 'manager'] }, // Not for employees
  { label: 'Attendance', roles: ['admin', 'hr', 'manager', 'employee'] },
  { label: 'Leave', roles: ['admin', 'hr', 'manager', 'employee'] },
  // ... etc
];

// Automatically filters based on user role
const filteredMenuItems = menuItems.filter(item =>
  membership && item.roles.includes(membership.role)
);
```

---

## 🔐 Database-Level Security

**Row Level Security (RLS) enforces data isolation:**

- Employees can only query their own records
- Cannot access other employees' data via API
- All queries filtered by `user_id` or `employee_id`
- Protected at PostgreSQL level
- Frontend AND backend secured

---

## ✨ Employee Self-Service Features

### **Attendance Management**
- GPS-based location tracking
- Automatic work hours calculation
- Check-in/check-out with one click
- View monthly attendance report

### **Leave Management**
- Multiple leave types (sick, casual, earned)
- Real-time leave balance
- Leave approval workflow
- Calendar integration

### **Expense Management**
- Multi-item expense claims
- Receipt upload (images/PDFs)
- Category-wise tracking
- Reimbursement status

### **Task Management**
- Kanban-style task board
- Status updates (To Do, In Progress, Done)
- Priority levels
- GitHub integration support

### **Performance Tracking**
- KPI goals
- Self-assessment forms
- 360° feedback
- Performance timeline

---

## 📝 Summary

### **Admin View:**
- 14 modules total
- Full system access
- Can manage everything
- See all employees' data

### **Employee View:**
- 10 modules total
- Personal data only
- Self-service features
- Cannot manage others

### **Key Difference:**
Employees see a **simplified, personal dashboard** focused on their own data and self-service actions, while admins see the **full management interface** with all organizational data.

---

## 🚀 Next Steps

1. **Login as your admin account**
2. **Go to Employees module**
3. **Add a test employee**
4. **Complete registration via invitation**
5. **Login as employee to see the difference!**

The role-based system is fully functional and automatically shows the right interface based on who's logged in.

---

**Last Updated:** October 31, 2024
**Version:** 2.0 (Fixed)
**Status:** Working ✅
