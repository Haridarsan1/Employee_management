# Performance Management Module - Implementation Guide

## Overview

The Performance Management module has been completely rebuilt with separate, comprehensive flows for Employee and Owner portals. The system provides real-time synchronization of performance data, goal tracking, and review management.

## Product Name Update

The product has been rebranded from **PulseHR** to **LogHR** across all landing pages and branding materials.

## Architecture

### Two-Portal System

1. **Employee Portal** (`EmployeePerformancePage.tsx`)
   - Focused, personal performance dashboard
   - View assigned goals and their progress
   - Update goal progress with notes
   - Submit completion requests
   - View performance reviews and feedback
   - Historical performance tracking

2. **Owner Portal** (`OwnerPerformancePage.tsx`)
   - Full organizational performance dashboard
   - Create, edit, and delete goals for any employee
   - Assign OKRs/KPIs to employees
   - Monitor progress across all employees
   - Filter by department and individual employees
   - Create and manage review cycles
   - Comprehensive analytics and reporting

### Real-Time Synchronization

- Implemented using Supabase Realtime subscriptions
- Employee changes instantly appear in Owner portal
- Owner updates instantly appear in Employee portal
- No manual refresh required

## Database Schema

### Tables

#### `goals` (renamed from `performance_goals`)
```sql
- id: uuid (PK)
- organization_id: uuid (FK)
- employee_id: uuid (FK)
- title: text
- description: text
- goal_type: enum ('okr', 'kpi', 'project', 'personal', 'team')
- status: enum ('active', 'completed', 'overdue', 'cancelled')
- progress: integer (0-100)
- target_value: numeric
- current_value: numeric
- unit: text
- start_date: date
- end_date: date
- completed_at: timestamptz
- created_by: uuid (FK to employees)
- created_at: timestamptz
- updated_at: timestamptz
```

#### `performance_reviews`
```sql
- id: uuid (PK)
- organization_id: uuid (FK)
- employee_id: uuid (FK)
- reviewer_id: uuid (FK)
- review_type: enum ('quarterly', 'half_yearly', 'annual', 'probation', 'performance_improvement')
- review_cycle: text
- rating: numeric (1-5)
- feedback: text
- strengths: text
- areas_for_improvement: text
- goals_met: boolean
- status: enum ('pending', 'in_progress', 'completed', 'cancelled')
- review_date: date
- completed_at: timestamptz
- created_at: timestamptz
- updated_at: timestamptz
```

#### `goal_updates`
```sql
- id: uuid (PK)
- goal_id: uuid (FK)
- updated_by: uuid (FK to employees)
- progress: integer (0-100)
- notes: text
- created_at: timestamptz
```

### Migration

A comprehensive migration file has been created:
- `supabase/migrations/20251118000000_enhance_performance_management.sql`

This migration:
- Updates existing `performance_goals` table and renames it to `goals`
- Enhances `performance_reviews` table with additional fields
- Creates new `goal_updates` table for progress tracking
- Adds appropriate indexes for performance
- Implements Row Level Security (RLS) policies
- Creates triggers for automatic status updates
- Adds timestamp management

## Features

### Employee Portal Features

1. **Performance Dashboard**
   - Visual stats cards showing:
     - Active goals count
     - Completed goals count
     - Overdue goals count
     - Average progress percentage
     - Average performance rating

2. **Goal Management**
   - View all assigned goals with details
   - See goal type (OKR, KPI, Project, Personal, Team)
   - Track progress with visual progress bars
   - Filter by status (Active, Completed, Overdue)
   - Filter by goal type
   - View target values and current progress
   - See due dates and time remaining

3. **Progress Updates**
   - Update progress percentage with slider
   - Add notes explaining progress
   - View complete progress history
   - Timeline of all updates with notes
   - Request completion review when near 100%

4. **Performance Reviews**
   - View all received reviews
   - See ratings (1-5 stars)
   - Read detailed feedback
   - View strengths identified by managers
   - See areas for improvement
   - Track review cycles and types
   - Historical review archive

### Owner Portal Features

1. **Organizational Dashboard**
   - Comprehensive stats overview:
     - Total goals across organization
     - Active goals count
     - Completed goals count
     - Overdue goals requiring attention
     - Average organizational progress
     - Average performance rating
   
2. **Goal Management**
   - Create new goals for any employee
   - Assign specific goal types (OKR, KPI, etc.)
   - Set target values and units
   - Define start and end dates
   - Edit existing goals
   - Delete goals with confirmation
   - Real-time status updates

3. **Advanced Filtering**
   - Search by goal title or employee name
   - Filter by goal status
   - Filter by goal type
   - Filter by department (via ScopeBar)
   - Filter by individual employee (via ScopeBar)

4. **Review Management**
   - Create performance review cycles
   - Select review type and cycle period
   - Rate employees (1-5 stars)
   - Provide detailed feedback
   - Document strengths
   - Identify improvement areas
   - Track goal completion
   - Mark reviews as completed
   - Edit existing reviews

5. **Analytics Dashboard**
   - **Overview Metrics:**
     - Employees with goals
     - Average goal progress
     - Employees reviewed
     - Coverage percentages
   
   - **Goals by Type Chart:**
     - Visual breakdown of OKRs, KPIs, Projects, etc.
     - Horizontal bar chart with counts
   
   - **Goals by Department:**
     - Department-wise goal distribution
     - Helps identify focus areas
   
   - **Performance Distribution:**
     - Circular stat cards showing:
       - Completed goals
       - Active goals
       - Overdue goals
     - Percentage breakdowns

## User Experience

### Employee View
- Clean, focused interface showing only personal data
- Motivating progress indicators
- Clear action buttons for updates
- Historical tracking for growth visibility
- No access to other employees' data

### Owner View
- Comprehensive organizational overview
- Powerful filtering and search
- Quick actions (edit, delete)
- Tab-based navigation (Goals, Reviews, Analytics)
- Scope-based filtering for large organizations
- Data-driven decision making with analytics

## Real-Time Sync Implementation

### Employee to Owner
```typescript
// When employee updates progress:
1. Progress saved to goal_updates table
2. Goal progress and status updated
3. Realtime event triggered
4. Owner's dashboard automatically refreshes
5. Updated progress visible instantly
```

### Owner to Employee
```typescript
// When owner creates/updates goal:
1. Goal saved to database
2. Realtime event triggered
3. Employee's dashboard automatically refreshes
4. New/updated goal visible instantly
```

### Subscription Setup
```typescript
const subscription = supabase
  .channel('performance-channel')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'goals',
    filter: `employee_id=eq.${employeeId}`
  }, () => {
    fetchPerformanceData(); // Refresh data
  })
  .subscribe();
```

## Security & Permissions

### Row Level Security (RLS)

1. **Goals Table**
   - All organization members can view goals
   - Only managers/owners/HR can create goals
   - Only managers/owners/HR can update goals
   - Only managers/owners/HR can delete goals

2. **Performance Reviews Table**
   - All organization members can view reviews
   - Only managers/owners/HR can create reviews
   - Only managers/owners/HR can update reviews

3. **Goal Updates Table**
   - All organization members can view updates
   - Employees can create updates for their own goals
   - Managers can create updates for any goal

### Role-Based Access

```typescript
// Check user role for portal routing
const isManagement = ['owner', 'admin', 'hr', 'manager']
  .includes(organizationMember.role);

// Show appropriate portal
{isManagement ? <OwnerPerformancePage /> : <EmployeePerformancePage />}
```

## Automatic Features

### Status Management
- Goals automatically marked as 'overdue' when past due date
- Goals automatically marked as 'completed' when progress reaches 100%
- Completion timestamp automatically set
- Triggers handle status transitions

### Timestamp Management
- `updated_at` automatically updated on record changes
- `created_at` automatically set on record creation
- Triggers ensure consistency

## UI Components

### Stats Cards
- Gradient backgrounds (blue, emerald, red, yellow, purple)
- Large numeric displays
- Icon indicators
- Contextual information

### Goal Cards
- Title and description
- Status badges (Active, Completed, Overdue)
- Type badges (OKR, KPI, etc.)
- Progress bars with color coding:
  - Green: 100% (completed)
  - Blue: 75-99%
  - Yellow: 50-74%
  - Orange: 0-49%
- Action buttons
- Latest update preview

### Modals
- Full-screen overlays with backdrop
- Scrollable content
- Form validation
- Cancel/Submit actions
- Responsive design

### Progress Indicators
- Slider input (0-100%)
- Visual progress bars
- Percentage display
- Historical timeline

## Integration Points

### With Scope System
```typescript
// Owner portal respects scope filters
const { selectedDepartmentId, selectedEmployeeId } = useScope();

// Filters goals based on scope
if (selectedDepartmentId) {
  query = query.eq('department_id', selectedDepartmentId);
}
```

### With Auth System
```typescript
// Gets current user and organization
const { organizationMember } = useAuth();

// Uses for permissions and data filtering
organization_id: organizationMember.organization_id
employee_id: organizationMember.employee_id
```

## File Structure

```
src/pages/Performance/
├── PerformancePage.tsx           # Main router component
├── EmployeePerformancePage.tsx   # Employee portal (970 lines)
├── OwnerPerformancePage.tsx      # Owner portal (1,271 lines)
└── index.ts                      # Exports

src/lib/
└── database.types.ts             # Updated with Goal, PerformanceReview, GoalUpdate

supabase/migrations/
└── 20251118000000_enhance_performance_management.sql  # Database schema
```

## Usage Instructions

### For Employees

1. **View Goals:**
   - Navigate to Performance section
   - See all assigned goals with progress
   - Filter by status or type as needed

2. **Update Progress:**
   - Click "Update Progress" on any active goal
   - Adjust progress slider
   - Add notes about accomplishments
   - Submit update

3. **Request Completion:**
   - When goal is 90%+ complete
   - Click "Request Completion" button
   - Manager will review and approve

4. **View Reviews:**
   - Scroll to Performance Reviews section
   - Click "View Details" on any review
   - Read feedback, strengths, and improvement areas

### For Owners/Managers

1. **Create Goals:**
   - Click "New Goal" button
   - Select employee
   - Fill in goal details
   - Set target values and dates
   - Submit

2. **Monitor Progress:**
   - View all goals in organization
   - Filter by department/employee
   - Search by keywords
   - Check progress bars
   - Review overdue goals

3. **Edit/Delete Goals:**
   - Click edit icon on goal card
   - Modify details as needed
   - Or click delete to remove

4. **Create Reviews:**
   - Click "New Review" button
   - Select employee
   - Choose review type and cycle
   - Rate employee (1-5 stars)
   - Provide feedback
   - Document strengths and improvements
   - Submit

5. **View Analytics:**
   - Click "Analytics" tab
   - Review organizational metrics
   - Check goal distribution
   - Identify trends
   - Make data-driven decisions

## Best Practices

### Goal Setting
- Use SMART criteria (Specific, Measurable, Achievable, Relevant, Time-bound)
- Set realistic target values
- Align with organizational objectives
- Regular review and updates

### Progress Tracking
- Update progress weekly
- Include detailed notes
- Be honest about challenges
- Celebrate milestones

### Reviews
- Conduct regularly (quarterly recommended)
- Be specific in feedback
- Balance strengths and improvements
- Link to concrete examples
- Follow up with action plans

## Troubleshooting

### Data Not Syncing
1. Check browser console for errors
2. Verify Supabase connection
3. Confirm RLS policies are active
4. Check user permissions

### Performance Issues
1. Use filters to reduce data load
2. Check database indexes
3. Monitor Realtime connection
4. Optimize queries if needed

### Permission Errors
1. Verify user role in organization_members
2. Check RLS policies
3. Confirm employee_id linkage
4. Review organization membership

## Future Enhancements

Potential additions:
- Goal templates library
- Bulk goal assignment
- Goal cascading (company → department → individual)
- 360-degree feedback system
- Performance improvement plans
- Goal collaboration and comments
- Mobile app support
- Export reports (PDF/Excel)
- Goal dependencies
- Automated reminders
- Performance trends over time
- Goal recommendations (AI)

## Technical Notes

### Performance Optimization
- Indexed columns: employee_id, organization_id, status, end_date
- RLS policies optimized for common queries
- Realtime subscriptions scoped to relevant data
- Lazy loading for large datasets

### Database Constraints
- Check constraints on ratings (1-5)
- Check constraints on progress (0-100)
- Foreign key cascades for data integrity
- Unique constraints where appropriate

### Error Handling
- Try-catch blocks on all database operations
- User-friendly error messages
- Console logging for debugging
- Graceful degradation

## Support

For issues or questions:
1. Check browser console for errors
2. Review RLS policies in Supabase
3. Verify migration has been applied
4. Check user permissions
5. Review this documentation

---

**Implementation Date:** November 18, 2025
**Version:** 1.0.0
**Status:** Production Ready
