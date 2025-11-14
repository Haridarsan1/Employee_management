import { useEffect, useState } from 'react';
import { 
  Headphones, Plus, X, Send, Filter, Search, Clock, CheckCircle, 
  AlertCircle, AlertTriangle, Circle, User, Calendar, Tag, Paperclip,
  MessageSquare, ChevronRight, FileText, Upload, Loader2, XCircle,
  UserPlus, Download, BarChart3, TrendingUp, PieChart, Shield, Lock,
  CheckSquare, Users, List, BookOpen, ArrowRight, Eye
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { HelpdeskCalendar } from './HelpdeskCalendar';

interface SupportTicket {
  id: string;
  ticket_number: string;
  category: string;
  priority: string;
  subject: string;
  description: string;
  status: string;
  employee_id: string;
  assigned_to: string | null;
  department_id: string | null;
  created_at: string;
  updated_at: string;
  last_activity_at: string;
  sla_due_date: string | null;
  is_overdue: boolean;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  employees: {
    first_name: string;
    last_name: string;
    employee_code: string;
    department_id: string;
    departments?: {
      name: string;
    };
  };
  assigned_employee?: {
    first_name: string;
    last_name: string;
  };
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  department_id: string;
}

interface Department {
  id: string;
  name: string;
}

interface TicketComment {
  id: string;
  ticket_id: string;
  employee_id: string;
  comment: string;
  is_internal: boolean;
  created_at: string;
  employees: {
    first_name: string;
    last_name: string;
    employee_code: string;
  };
}

interface TicketAttachment {
  id: string;
  ticket_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

interface NewTicketForm {
  category: string;
  priority: string;
  subject: string;
  description: string;
}

interface AlertModal {
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

const CATEGORIES = [
  { value: 'technical', label: 'Technical/IT Support', icon: '💻' },
  { value: 'hr', label: 'HR Related', icon: '👥' },
  { value: 'admin', label: 'Admin/Facility', icon: '🏢' },
  { value: 'payroll', label: 'Payroll Issue', icon: '💰' },
  { value: 'leave', label: 'Leave Related', icon: '📅' },
  { value: 'attendance', label: 'Attendance Issue', icon: '⏰' },
  { value: 'access', label: 'Access/Permissions', icon: '🔐' },
  { value: 'other', label: 'Other', icon: '📝' }
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700 border-red-300' }
];

const STATUS_CONFIG = {
  open: { label: 'Open', icon: Circle, color: 'text-blue-600 bg-blue-100' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
  waiting_on_customer: { label: 'Waiting on You', icon: AlertCircle, color: 'text-orange-600 bg-orange-100' },
  resolved: { label: 'Resolved', icon: CheckCircle, color: 'text-green-600 bg-green-100' },
  closed: { label: 'Closed', icon: XCircle, color: 'text-slate-600 bg-slate-100' },
  reopened: { label: 'Reopened', icon: AlertTriangle, color: 'text-red-600 bg-red-100' }
};

export function HelpdeskPage() {
  const { membership, organization, user } = useAuth();
  const isAdmin = membership?.role && ['owner', 'admin', 'hr'].includes(membership.role);
  
  console.log('🎫 HelpdeskPage rendered', {
    hasUser: !!user,
    userId: user?.id,
    userEmail: user?.email,
    hasMembership: !!membership,
    membershipRole: membership?.role,
    isAdmin,
    hasOrg: !!organization,
    orgId: organization?.id
  });
  
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [alertModal, setAlertModal] = useState<AlertModal | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [assignedFilter, setAssignedFilter] = useState('all');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [overdueFilter, setOverdueFilter] = useState(false);
  
  // Admin Data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [staffMembers, setStaffMembers] = useState<Employee[]>([]);
  
  // Bulk Actions
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  
  // Admin Actions in Detail Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [assignToId, setAssignToId] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  
  // Analytics
  const [analytics, setAnalytics] = useState({
    byDepartment: [] as { department: string; count: number }[],
    byCategory: [] as { category: string; count: number }[],
    bySLA: { onTime: 0, overdue: 0 },
    avgResolutionTime: 0,
    openVsClosed: { open: 0, closed: 0 }
  });
  
  // New Ticket Form
  const [newTicketForm, setNewTicketForm] = useState<NewTicketForm>({
    category: '',
    priority: 'medium',
    subject: '',
    description: ''
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  
  // Knowledge Base Suggestions
  const [kbSuggestions, setKbSuggestions] = useState<any[]>([]);
  const [showKbSuggestions, setShowKbSuggestions] = useState(false);
  const [selectedKbArticle, setSelectedKbArticle] = useState<any>(null);
  const [showKbArticleModal, setShowKbArticleModal] = useState(false);
  
  // Ticket Details
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [ticketAttachments, setTicketAttachments] = useState<TicketAttachment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Load employee_id from user_id or email
  useEffect(() => {
    const loadEmployeeId = async () => {
      console.log('👤 Attempting to load employee_id...', { 
        hasUser: !!user, 
        userId: user?.id, 
        userEmail: user?.email,
        hasOrg: !!organization, 
        orgId: organization?.id 
      });
      
      if (!user?.id || !organization?.id) {
        console.warn('⚠️ Cannot load employee_id - missing user or organization');
        return;
      }
      
      try {
        // First, try to find employee by user_id
        let { data, error } = await supabase
          .from('employees')
          .select('id, user_id')
          .eq('user_id', user.id)
          .eq('organization_id', organization.id)
          .maybeSingle();
        
        if (error) {
          console.error('❌ Error loading employee_id by user_id:', error);
        }
        
        // If not found by user_id, try to find by company_email and auto-link
        if (!data && user.email) {
          console.log('🔍 Employee not found by user_id, searching by company_email:', user.email);
          const { data: employeeByEmail, error: emailError } = await supabase
            .from('employees')
            .select('id, user_id, company_email')
            .eq('organization_id', organization.id)
            .eq('company_email', user.email)
            .maybeSingle();
          
          if (emailError) {
            console.error('❌ Error loading employee by email:', emailError);
            console.error('Error details:', { message: emailError.message, details: emailError.details, hint: emailError.hint });
            // Don't throw, just log and continue
          }
          
          if (employeeByEmail && !employeeByEmail.user_id) {
            console.log('🔗 Found unlinked employee, auto-linking to user_id:', user.id);
            // Auto-link the employee to this user
            const { error: updateError } = await supabase
              .from('employees')
              .update({ user_id: user.id })
              .eq('id', employeeByEmail.id);
            
            if (updateError) {
              console.error('❌ Error auto-linking employee:', updateError);
            } else {
              console.log('✅ Successfully auto-linked employee:', employeeByEmail.id);
              data = { id: employeeByEmail.id, user_id: user.id };
            }
          } else if (employeeByEmail && employeeByEmail.user_id) {
            console.log('✅ Found already-linked employee:', employeeByEmail.id);
            data = { id: employeeByEmail.id, user_id: employeeByEmail.user_id };
          }
        }
        
        if (data) {
          console.log('✅ Loaded employee_id:', data.id);
          setEmployeeId(data.id);
        } else {
          console.warn('⚠️ No employee record found for user:', user.id, 'email:', user.email);
        }
      } catch (error) {
        console.error('❌ Exception loading employee_id:', error);
      }
    };
    
    loadEmployeeId();
  }, [user, organization]);

  useEffect(() => {
    console.log('🔄 Helpdesk useEffect triggered', { 
      hasMembership: !!membership, 
      hasEmployeeId: !!employeeId,
      hasOrganization: !!organization,
      hasOrgId: !!organization?.id,
      isAdmin,
      userEmail: user?.email
    });
    
    // Admins can view helpdesk without employee_id (for ticket management)
    // Regular employees need employee_id to create their own tickets
    if (organization?.id) {
      if (isAdmin) {
        console.log('👑 Loading helpdesk for admin/owner');
        loadTickets();
        loadAdminData();
      } else if (employeeId) {
        console.log('👤 Loading helpdesk for employee');
        loadTickets();
      } else {
        console.warn('⚠️ Employee waiting for employee_id to be loaded');
        // Don't set loading to false yet, employeeId is still being loaded
      }
    } else {
      console.warn('⚠️ Missing organization for helpdesk');
      setLoading(false);
    }
  }, [employeeId, organization, isAdmin, user]);

  useEffect(() => {
    // Trigger KB search when subject or description changes
    const searchText = (newTicketForm.subject + ' ' + newTicketForm.description).trim();
    const timeoutId = setTimeout(() => {
      searchKBArticles(searchText);
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [newTicketForm.subject, newTicketForm.description]);

  const loadAdminData = async () => {
    if (!organization?.id) return;

    try {
      // Load all employees
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code, department_id')
        .eq('organization_id', organization.id)
        .in('employment_status', ['active', 'probation'])
        .order('first_name');

      if (empError) {
        console.error('Error loading employees:', empError);
      } else {
        setEmployees(empData || []);
      }

      // Load staff members (get user_ids of admin/hr roles, then get their employees)
      const { data: adminUsers, error: adminError } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organization.id)
        .in('role', ['owner', 'admin', 'hr'])
        .eq('is_active', true);

      if (adminError) {
        console.error('Error loading admin users:', adminError);
      } else if (adminUsers && adminUsers.length > 0) {
        const userIds = adminUsers.map(u => u.user_id);
        
        const { data: staffData, error: staffError } = await supabase
          .from('employees')
          .select('id, first_name, last_name, employee_code, department_id, user_id')
          .eq('organization_id', organization.id)
          .in('user_id', userIds)
          .in('employment_status', ['active', 'probation']);
        
        if (staffError) {
          console.error('Error loading staff members:', staffError);
        } else {
          setStaffMembers(staffData || []);
        }
      }

      // Load departments
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('id, name')
        .eq('organization_id', organization.id)
        .order('name');

      if (deptError) {
        console.error('Error loading departments:', deptError);
      } else {
        setDepartments(deptData || []);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  };

  const searchKBArticles = async (searchText: string) => {
    if (!organization?.id || !searchText || searchText.length < 3) {
      setKbSuggestions([]);
      setShowKbSuggestions(false);
      return;
    }

    try {
      const search = searchText.toLowerCase();
      const { data, error } = await supabase
        .from('kb_articles')
        .select('id, title, category, description, views')
        .eq('organization_id', organization.id)
        .or('title.ilike.%' + search + '%,description.ilike.%' + search + '%,content.ilike.%' + search + '%')
        .order('views', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (data && data.length > 0) {
        setKbSuggestions(data);
        setShowKbSuggestions(true);
      } else {
        setKbSuggestions([]);
        setShowKbSuggestions(false);
      }
    } catch (error) {
      console.error('Error searching KB articles:', error);
    }
  };

  const openKBArticle = async (articleId: string) => {
    try {
      const { data, error } = await supabase
        .from('kb_articles')
        .select('*, author:created_by(first_name, last_name)')
        .eq('id', articleId)
        .single();

      if (error) throw error;

      setSelectedKbArticle(data);
      setShowKbArticleModal(true);

      // Increment view count
      await supabase
        .from('kb_articles')
        .update({ views: data.views + 1 })
        .eq('id', articleId);
    } catch (error) {
      console.error('Error loading KB article:', error);
    }
  };

  const loadTickets = async () => {
    // Admins can view without employee_id, regular users need it
    if (!organization?.id || (!isAdmin && !employeeId)) return;

    try {
      console.log('🎫 Loading helpdesk tickets...', { isAdmin, orgId: organization.id, empId: employeeId });
      setLoading(true);
      
      let query = supabase
        .from('support_tickets')
        .select('*, employees:employee_id(first_name, last_name, employee_code, department_id, departments:department_id(name)), assigned_employee:assigned_to(first_name, last_name)');

      // If admin, load all tickets, else just employee's tickets
      if (isAdmin) {
        query = query.eq('organization_id', organization.id);
      } else {
        query = query.eq('employee_id', employeeId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Database error loading tickets:', error);
        throw error;
      }
      console.log('✅ Helpdesk tickets loaded:', data?.length || 0);
      setTickets(data || []);
      
      if (isAdmin) {
        calculateAnalytics(data || []);
      }
    } catch (error: any) {
      console.error('❌ Error loading helpdesk tickets:', error);
      console.error('Error details:', { 
        message: error.message, 
        code: error.code, 
        details: error.details, 
        hint: error.hint 
      });
      setAlertModal({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to load tickets'
      });
    } finally {
      setLoading(false);
      console.log('🏁 Helpdesk loading complete');
    }
  };

  const calculateAnalytics = (ticketData: SupportTicket[]) => {
    // By Department
    const deptMap = new Map<string, number>();
    ticketData.forEach(t => {
      const dept = t.employees.departments?.name || 'Unassigned';
      deptMap.set(dept, (deptMap.get(dept) || 0) + 1);
    });
    const byDepartment = Array.from(deptMap.entries()).map(([department, count]) => ({
      department,
      count
    }));

    // By Category
    const catMap = new Map<string, number>();
    ticketData.forEach(t => {
      catMap.set(t.category, (catMap.get(t.category) || 0) + 1);
    });
    const byCategory = Array.from(catMap.entries()).map(([category, count]) => ({
      category,
      count
    }));

    // SLA Performance
    const onTime = ticketData.filter(t => !t.is_overdue).length;
    const overdue = ticketData.filter(t => t.is_overdue).length;

    // Avg Resolution Time
    const resolvedTickets = ticketData.filter(t => t.resolved_at);
    const totalResolutionTime = resolvedTickets.reduce((sum, t) => {
      const created = new Date(t.created_at).getTime();
      const resolved = new Date(t.resolved_at!).getTime();
      return sum + (resolved - created);
    }, 0);
    const avgResolutionTime = resolvedTickets.length > 0
      ? totalResolutionTime / resolvedTickets.length / (1000 * 60 * 60) // hours
      : 0;

    // Open vs Closed
    const open = ticketData.filter(t => !['resolved', 'closed'].includes(t.status)).length;
    const closed = ticketData.filter(t => ['resolved', 'closed'].includes(t.status)).length;

    setAnalytics({
      byDepartment,
      byCategory,
      bySLA: { onTime, overdue },
      avgResolutionTime,
      openVsClosed: { open, closed }
    });
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !organization?.id) return;

    try {
      setSubmitting(true);

      // Generate ticket number
      const { data: ticketNumberData } = await supabase
        .rpc('generate_ticket_number');

      const ticketNumber = ticketNumberData || 'TKT-' + Date.now();

      // Calculate SLA due date based on priority
      const slaHoursMap: { [key: string]: number } = {
        low: 120,
        medium: 72,
        high: 24,
        critical: 8
      };

      const slaHours = slaHoursMap[newTicketForm.priority] || 72;
      const slaDueDate = new Date();
      slaDueDate.setHours(slaDueDate.getHours() + slaHours);


      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          organization_id: organization.id,
          employee_id: membership.employee_id,
          ticket_number: ticketNumber,
          category: newTicketForm.category,
          priority: newTicketForm.priority,
          subject: newTicketForm.subject,
          description: newTicketForm.description,
          status: 'open',
          sla_due_date: slaDueDate.toISOString()
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Log activity
      await supabase.from('ticket_activities').insert({
        ticket_id: ticket.id,
        employee_id: membership.employee_id,
        activity_type: 'created',
        description: 'Ticket created'
      });

      // Handle file uploads if any
      if (attachments.length > 0) {
        for (const file of attachments) {
          const fileExt = file.name.split('.').pop();
          const fileName = ticket.id + '/' + Date.now() + '.' + fileExt;
          
          const { error: uploadError } = await supabase.storage
            .from('ticket-attachments')
            .upload(fileName, file);

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('ticket-attachments')
              .getPublicUrl(fileName);

            await supabase.from('ticket_attachments').insert({
              ticket_id: ticket.id,
              uploaded_by: membership.employee_id,
              file_name: file.name,
              file_url: urlData.publicUrl,
              file_size: file.size,
              file_type: file.type
            });
          }
        }
      }

      setAlertModal({
        type: 'success',
        title: 'Ticket Created',
        message: 'Your support ticket ' + (ticketNumber || '') + ' has been created successfully.'
      });

      setShowNewTicketModal(false);
      setNewTicketForm({
        category: '',
        priority: 'medium',
        subject: '',
        description: ''
      });
      setAttachments([]);
      loadTickets();
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      setAlertModal({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to create ticket'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const loadTicketDetails = async (ticketId: string) => {
    try {
      // Load comments (include internal notes for admins)
      let commentsQuery = supabase
        .from('ticket_comments')
        .select('*, employees(first_name, last_name, employee_code)')
        .eq('ticket_id', ticketId);

      // Non-admins can only see public comments
      if (!isAdmin) {
        commentsQuery = commentsQuery.eq('is_internal', false);
      }

      const { data: commentsData, error: commentsError } = await commentsQuery
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;
      setComments(commentsData || []);

      // Load attachments
      const { data: attachmentsData, error: attachmentsError } = await supabase
        .from('ticket_attachments')
        .select('*')
        .eq('ticket_id', ticketId)
        .is('comment_id', null)
        .order('created_at', { ascending: false });

      if (attachmentsError) throw attachmentsError;
      setTicketAttachments(attachmentsData || []);
    } catch (error) {
      console.error('Error loading ticket details:', error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !membership?.employee_id || !newComment.trim()) return;

    try {
      setCommentSubmitting(true);

      const { error } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: selectedTicket.id,
          employee_id: membership.employee_id,
          comment: newComment.trim(),
          is_internal: isAdmin && isInternalComment
        });

      if (error) throw error;

      // Log activity
      await supabase.from('ticket_activities').insert({
        ticket_id: selectedTicket.id,
        employee_id: membership.employee_id,
        activity_type: 'commented',
        description: isInternalComment ? 'Added an internal note' : 'Added a comment'
      });

      setNewComment('');
      setIsInternalComment(false);
      loadTicketDetails(selectedTicket.id);
    } catch (error: any) {
      console.error('Error adding comment:', error);
      setAlertModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to add comment'
      });
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleReopenTicket = async () => {
    if (!selectedTicket || !membership?.employee_id) return;

    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          status: 'reopened',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTicket.id);

      if (error) throw error;

      // Log activity
      await supabase.from('ticket_activities').insert({
        ticket_id: selectedTicket.id,
        employee_id: membership.employee_id,
        activity_type: 'reopened',
        description: 'Ticket reopened by employee'
      });

      setAlertModal({
        type: 'success',
        title: 'Ticket Reopened',
        message: 'The ticket has been reopened successfully.'
      });

      setShowDetailModal(false);
      loadTickets();
    } catch (error: any) {
      console.error('Error reopening ticket:', error);
      setAlertModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to reopen ticket'
      });
    }
  };

  // Admin Functions
  const handleAssignTicket = async () => {
    if (!selectedTicket || !assignToId || !membership?.employee_id) return;

    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({
          assigned_to: assignToId,
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedTicket.id);

      if (error) throw error;

      // Log activity
      const assignedStaff = staffMembers.find(s => s.id === assignToId);
      await supabase.from('ticket_activities').insert({
        ticket_id: selectedTicket.id,
        employee_id: membership.employee_id,
        activity_type: 'assigned',
        new_value: (assignedStaff?.first_name || '') + ' ' + (assignedStaff?.last_name || ''),
        description: 'Ticket assigned to ' + (assignedStaff?.first_name || '') + ' ' + (assignedStaff?.last_name || '')
      });

      setAlertModal({
        type: 'success',
        title: 'Ticket Assigned',
        message: 'Ticket has been assigned successfully.'
      });

      setShowAssignModal(false);
      setAssignToId('');
      loadTickets();
      if (selectedTicket) {
        const updatedTicket = tickets.find(t => t.id === selectedTicket.id);
        if (updatedTicket) setSelectedTicket(updatedTicket);
      }
    } catch (error: any) {
      console.error('Error assigning ticket:', error);
      setAlertModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to assign ticket'
      });
    }
  };

  const handleChangeStatus = async () => {
    if (!selectedTicket || !newStatus || !membership?.employee_id) return;

    try {
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      // If resolving, add resolution data
      if (newStatus === 'resolved' && resolutionNotes) {
        updateData.resolution_notes = resolutionNotes;
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = membership.employee_id;
      }

      // If closing, add closed data
      if (newStatus === 'closed') {
        updateData.closed_at = new Date().toISOString();
        updateData.closed_by = membership.employee_id;
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updateData)
        .eq('id', selectedTicket.id);

      if (error) throw error;

      // Log activity
      await supabase.from('ticket_activities').insert({
        ticket_id: selectedTicket.id,
        employee_id: membership.employee_id,
        activity_type: 'status_changed',
        old_value: selectedTicket.status,
        new_value: newStatus,
        description: 'Status changed from ' + selectedTicket.status + ' to ' + newStatus
      });

      setAlertModal({
        type: 'success',
        title: 'Status Updated',
        message: 'Ticket status has been updated successfully.'
      });

      setShowStatusModal(false);
      setNewStatus('');
      setResolutionNotes('');
      loadTickets();
      if (selectedTicket) {
        const updatedTicket = tickets.find(t => t.id === selectedTicket.id);
        if (updatedTicket) setSelectedTicket(updatedTicket);
      }
    } catch (error: any) {
      console.error('Error changing status:', error);
      setAlertModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to change status'
      });
    }
  };

  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !membership?.employee_id || !internalNote.trim()) return;

    try {
      setCommentSubmitting(true);

      const { error } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: selectedTicket.id,
          employee_id: membership.employee_id,
          comment: internalNote.trim(),
          is_internal: true
        });

      if (error) throw error;

      // Log activity
      await supabase.from('ticket_activities').insert({
        ticket_id: selectedTicket.id,
        employee_id: membership.employee_id,
        activity_type: 'commented',
        description: 'Added an internal note'
      });

      setInternalNote('');
      loadTicketDetails(selectedTicket.id);
      
      setAlertModal({
        type: 'success',
        title: 'Internal Note Added',
        message: 'Internal note has been added (not visible to employee).'
      });
    } catch (error: any) {
      console.error('Error adding internal note:', error);
      setAlertModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to add internal note'
      });
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleBulkAssign = async (staffId: string) => {
    if (!employeeId || selectedTicketIds.length === 0) return;

    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({
          assigned_to: staffId,
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', selectedTicketIds);

      if (error) throw error;

      // Log activities
      for (const ticketId of selectedTicketIds) {
        const assignedStaff = staffMembers.find(s => s.id === staffId);
        await supabase.from('ticket_activities').insert({
          ticket_id: ticketId,
          employee_id: membership.employee_id,
          activity_type: 'assigned',
          new_value: (assignedStaff?.first_name || '') + ' ' + (assignedStaff?.last_name || ''),
          description: 'Bulk assigned to ' + (assignedStaff?.first_name || '') + ' ' + (assignedStaff?.last_name || '')
        });
      }

      setAlertModal({
        type: 'success',
        title: 'Bulk Assignment Complete',
        message: selectedTicketIds.length + ' tickets have been assigned.'
      });

      setSelectedTicketIds([]);
      setShowBulkActions(false);
      loadTickets();
    } catch (error: any) {
      console.error('Error bulk assigning:', error);
      setAlertModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to assign tickets'
      });
    }
  };

  const handleBulkClose = async () => {
    if (!employeeId || selectedTicketIds.length === 0) return;

    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: membership.employee_id,
          updated_at: new Date().toISOString()
        })
        .in('id', selectedTicketIds);

      if (error) throw error;

      // Log activities
      for (const ticketId of selectedTicketIds) {
        await supabase.from('ticket_activities').insert({
          ticket_id: ticketId,
          employee_id: membership.employee_id,
          activity_type: 'closed',
          description: 'Bulk closed'
        });
      }

      setAlertModal({
        type: 'success',
        title: 'Bulk Close Complete',
        message: selectedTicketIds.length + ' tickets have been closed.'
      });

      setSelectedTicketIds([]);
      setShowBulkActions(false);
      loadTickets();
    } catch (error: any) {
      console.error('Error bulk closing:', error);
      setAlertModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to close tickets'
      });
    }
  };

  const exportToCSV = () => {
    const csvData = filteredTickets.map(t => ({
      'Ticket ID': t.ticket_number,
      'Subject': t.subject,
      'Category': t.category,
      'Priority': t.priority,
      'Status': t.status,
      'Employee': (t.employees.first_name || '') + ' ' + (t.employees.last_name || ''),
      'Department': t.employees.departments?.name || 'N/A',
      'Assigned To': t.assigned_employee ? (t.assigned_employee.first_name || '') + ' ' + (t.assigned_employee.last_name || '') : 'Unassigned',
      'Created': new Date(t.created_at).toLocaleDateString(),
      'Overdue': t.is_overdue ? 'Yes' : 'No'
    }));

    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => '"' + row[h as keyof typeof row] + '"').join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'helpdesk-tickets-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const toggleTicketSelection = (ticketId: string) => {
    setSelectedTicketIds(prev =>
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const toggleAllTickets = () => {
    if (selectedTicketIds.length === filteredTickets.length) {
      setSelectedTicketIds([]);
    } else {
      setSelectedTicketIds(filteredTickets.map(t => t.id));
    }
  };

  const openTicketDetail = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setShowDetailModal(true);
    loadTicketDetails(ticket.id);
    setNewComment('');
    setInternalNote('');
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter;
    
    // Admin filters
    const matchesDepartment = !isAdmin || departmentFilter === 'all' || ticket.employees.department_id === departmentFilter;
    const matchesEmployee = !isAdmin || employeeFilter === 'all' || ticket.employee_id === employeeFilter;
    const matchesAssigned = !isAdmin || assignedFilter === 'all' || 
      (assignedFilter === 'unassigned' ? !ticket.assigned_to : ticket.assigned_to === assignedFilter);
    const matchesOverdue = !overdueFilter || ticket.is_overdue;
    
    const matchesDateFrom = !dateFromFilter || new Date(ticket.created_at) >= new Date(dateFromFilter);
    const matchesDateTo = !dateToFilter || new Date(ticket.created_at) <= new Date(dateToFilter);
    
    return matchesSearch && matchesStatus && matchesPriority && matchesCategory && 
           matchesDepartment && matchesEmployee && matchesAssigned && matchesOverdue &&
           matchesDateFrom && matchesDateTo;
  });

  const handleCalendarTicketClick = (ticketId: string) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      openTicketDetail(ticket);
    }
  };

  const getTicketStats = () => {
    return {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'open').length,
      inProgress: tickets.filter(t => t.status === 'in_progress').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      overdue: tickets.filter(t => t.is_overdue && !['resolved', 'closed'].includes(t.status)).length
    };
  };

  const stats = getTicketStats();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return diffMins + 'm ago';
    if (diffHours < 24) return diffHours + 'h ago';
    if (diffDays < 7) return diffDays + 'd ago';
    return date.toLocaleDateString();
  };

  const getPriorityBadge = (priority: string) => {
    const config = PRIORITIES.find(p => p.value === priority);
    return config || PRIORITIES[1];
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.open;
  };

  const getCategoryLabel = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat ? cat.icon + ' ' + cat.label : category;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Headphones className="h-8 w-8 text-pink-600" />
            Helpdesk & Support
            {isAdmin && <span className="text-lg font-normal text-pink-600 flex items-center gap-2"><Shield className="h-5 w-5" /> Admin Mode</span>}
          </h1>
          <p className="text-slate-600 mt-2">{isAdmin ? 'Manage all support tickets across the organization' : 'Create and track your support tickets'}</p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-pink-600 text-pink-600 rounded-xl font-semibold hover:bg-pink-50 transition-all"
            >
              <Download className="h-5 w-5" />
              Export CSV
            </button>
          )}
          {/* New Ticket button - only for employees, not owners/admins */}
          {!isAdmin && employeeId && (
            <button 
              onClick={() => setShowNewTicketModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-pink-600 to-pink-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
              title="Create a new support ticket"
            >
              <Plus className="h-5 w-5" />
              New Ticket
            </button>
          )}
          {/* Show message if employee doesn't have employee record */}
          {!isAdmin && !employeeId && (
            <div className="px-4 py-2 bg-yellow-50 border-2 border-yellow-300 rounded-xl text-sm text-yellow-800">
              <AlertCircle className="inline h-4 w-4 mr-2" />
              Your employee profile is not set up yet. Contact your administrator.
            </div>
          )}
        </div>
      </div>

      {/* Info banner for admins */}
      {isAdmin && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900">Owner/Admin Management View</p>
              <p className="text-sm text-blue-700 mt-1">
                You can view and manage all support tickets raised by employees. Employees create tickets from their portal.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Info/error banner for employees without employee record */}
      {!isAdmin && !employeeId && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Employee Profile Not Found</p>
              <p className="text-sm text-red-700 mt-1">
                Your employee profile is not linked to your account. Please contact your administrator to create your employee record and link it to your user account (User ID: {user?.id?.substring(0, 8)}...).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-1 flex gap-1 w-fit">
        <button
          onClick={() => setViewMode('list')}
          className={'flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ' + (
            viewMode === 'list'
              ? 'bg-gradient-to-r from-pink-600 to-pink-700 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-50'
          )}
        >
          <List className="h-5 w-5" />
          Ticket List
        </button>
        <button
          onClick={() => setViewMode('calendar')}
          className={'flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ' + (
            viewMode === 'calendar'
              ? 'bg-gradient-to-r from-pink-600 to-pink-700 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-50'
          )}
        >
          <Calendar className="h-5 w-5" />
          Calendar & SLA
        </button>
      </div>

      {/* Conditional View Rendering */}
      {viewMode === 'calendar' ? (
        <HelpdeskCalendar onTicketClick={handleCalendarTicketClick} />
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Total Tickets</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
            <FileText className="h-8 w-8 text-slate-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md border border-blue-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Open</p>
              <p className="text-2xl font-bold text-blue-700">{stats.open}</p>
            </div>
            <Circle className="h-8 w-8 text-blue-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md border border-yellow-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600">In Progress</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.inProgress}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md border border-green-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Resolved</p>
              <p className="text-2xl font-bold text-green-700">{stats.resolved}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-md border border-red-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600">Overdue</p>
              <p className="text-2xl font-bold text-red-700">{stats.overdue}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Admin Analytics */}
      {isAdmin && (
        <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl shadow-md border border-pink-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-pink-600" />
            Analytics Dashboard
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-600">Avg Resolution Time</p>
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-slate-900">{analytics.avgResolutionTime.toFixed(1)}h</p>
              <p className="text-xs text-slate-500 mt-1">Average time to resolve</p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-600">SLA Performance</p>
                <PieChart className="h-5 w-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-600">{analytics.bySLA.onTime}</p>
              <p className="text-xs text-slate-500 mt-1">
                On-time: {analytics.bySLA.onTime} | Overdue: {analytics.bySLA.overdue}
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-600">Open vs Closed</p>
                <BarChart3 className="h-5 w-5 text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-purple-600">{analytics.openVsClosed.open}</p>
              <p className="text-xs text-slate-500 mt-1">
                Open: {analytics.openVsClosed.open} | Closed: {analytics.openVsClosed.closed}
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-600">By Category</p>
                <Tag className="h-5 w-5 text-orange-500" />
              </div>
              <p className="text-2xl font-bold text-orange-600">{analytics.byCategory.length}</p>
              <p className="text-xs text-slate-500 mt-1">
                {analytics.byCategory.slice(0, 2).map(c => c.category + ': ' + c.count).join(', ')}
              </p>
            </div>
          </div>

          {/* Department Breakdown */}
          {analytics.byDepartment.length > 0 && (
            <div className="mt-4 bg-white rounded-xl p-4 border border-slate-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Tickets by Department</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {analytics.byDepartment.map((dept, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-700">{dept.department}</span>
                    <span className="text-sm font-bold text-pink-600">{dept.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters & Search */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              />
            </div>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting_on_customer">Waiting on Me</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
            <option value="reopened">Reopened</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
          >
            <option value="all">All Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>

          {/* Admin Filters */}
          {isAdmin && (
            <>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              >
                <option value="all">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>

              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              >
                <option value="all">All Employees</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                ))}
              </select>

              <select
                value={assignedFilter}
                onChange={(e) => setAssignedFilter(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
              >
                <option value="all">All Assignments</option>
                <option value="unassigned">Unassigned</option>
                {staffMembers.map(staff => (
                  <option key={staff.id} value={staff.id}>{staff.first_name} {staff.last_name}</option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFromFilter}
                  onChange={(e) => setDateFromFilter(e.target.value)}
                  placeholder="From"
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                />
                <span className="text-slate-500">to</span>
                <input
                  type="date"
                  value={dateToFilter}
                  onChange={(e) => setDateToFilter(e.target.value)}
                  placeholder="To"
                  className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                />
              </div>

              <label className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={overdueFilter}
                  onChange={(e) => setOverdueFilter(e.target.checked)}
                  className="rounded text-pink-600 focus:ring-pink-500"
                />
                <span className="text-sm font-medium text-slate-700">Overdue Only</span>
              </label>
            </>
          )}
        </div>

        {/* Bulk Actions for Admin */}
        {isAdmin && selectedTicketIds.length > 0 && (
          <div className="mt-4 p-4 bg-pink-50 border border-pink-200 rounded-lg flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700">
              {selectedTicketIds.length} ticket(s) selected
            </span>
            <div className="flex items-center gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkAssign(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              >
                <option value="">Bulk Assign To...</option>
                {staffMembers.map(staff => (
                  <option key={staff.id} value={staff.id}>{staff.first_name} {staff.last_name}</option>
                ))}
              </select>
              <button
                onClick={handleBulkClose}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Bulk Close
              </button>
              <button
                onClick={() => setSelectedTicketIds([])}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tickets List */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {isAdmin && (
                  <th className="text-left px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedTicketIds.length === filteredTickets.length && filteredTickets.length > 0}
                      onChange={toggleAllTickets}
                      className="rounded text-pink-600 focus:ring-pink-500"
                    />
                  </th>
                )}
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Ticket ID</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Subject</th>
                {isAdmin && <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Employee</th>}
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Category</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Priority</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Status</th>
                {isAdmin && <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Assigned To</th>}
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Created</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Last Update</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 11 : 8} className="px-6 py-12 text-center">
                    <Headphones className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-600 font-medium">No tickets found</p>
                    <p className="text-sm text-slate-500 mt-1">Create your first support ticket to get started</p>
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket) => {
                  const StatusIcon = getStatusConfig(ticket.status).icon;
                  const priorityBadge = getPriorityBadge(ticket.priority);
                  
                  return (
                    <tr 
                      key={ticket.id} 
                      className="hover:bg-slate-50 transition-colors"
                    >
                      {isAdmin && (
                        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedTicketIds.includes(ticket.id)}
                            onChange={() => toggleTicketSelection(ticket.id)}
                            className="rounded text-pink-600 focus:ring-pink-500"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 cursor-pointer" onClick={() => openTicketDetail(ticket)}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-pink-600">{ticket.ticket_number}</span>
                          {ticket.is_overdue && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => openTicketDetail(ticket)}>
                        <p className="font-medium text-slate-900 truncate max-w-xs">{ticket.subject}</p>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 cursor-pointer" onClick={() => openTicketDetail(ticket)}>
                          <div>
                            <p className="text-sm font-medium text-slate-900">
                              {ticket.employees.first_name} {ticket.employees.last_name}
                            </p>
                            <p className="text-xs text-slate-500">{ticket.employees.departments?.name || 'N/A'}</p>
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 cursor-pointer" onClick={() => openTicketDetail(ticket)}>
                        <span className="text-sm">{getCategoryLabel(ticket.category)}</span>
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => openTicketDetail(ticket)}>
                        <span className={'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ' + priorityBadge.color}>
                          {priorityBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => openTicketDetail(ticket)}>
                        <span className={'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ' + getStatusConfig(ticket.status).color}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {getStatusConfig(ticket.status).label}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 cursor-pointer" onClick={() => openTicketDetail(ticket)}>
                          {ticket.assigned_employee ? (
                            <span className="text-sm text-slate-700">
                              {ticket.assigned_employee.first_name} {ticket.assigned_employee.last_name}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400 italic">Unassigned</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm text-slate-600 cursor-pointer" onClick={() => openTicketDetail(ticket)}>
                        {formatDate(ticket.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 cursor-pointer" onClick={() => openTicketDetail(ticket)}>
                        {formatDate(ticket.last_activity_at)}
                      </td>
                      <td className="px-6 py-4 cursor-pointer" onClick={() => openTicketDetail(ticket)}>
                        <ChevronRight className="h-5 w-5 text-slate-400" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">Create New Ticket</h2>
              <button
                onClick={() => setShowNewTicketModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="p-6 space-y-6">
              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Category <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setNewTicketForm({ ...newTicketForm, category: cat.value })}
                      className={'p-4 border-2 rounded-xl text-left transition-all ' + (
                        newTicketForm.category === cat.value
                          ? 'border-pink-500 bg-pink-50'
                          : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <div className="text-2xl mb-1">{cat.icon}</div>
                      <div className="text-sm font-medium text-slate-900">{cat.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Priority <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {PRIORITIES.map((priority) => (
                    <button
                      key={priority.value}
                      type="button"
                      onClick={() => setNewTicketForm({ ...newTicketForm, priority: priority.value })}
                      className={'px-4 py-3 border-2 rounded-xl text-sm font-medium transition-all ' + (
                        newTicketForm.priority === priority.value
                          ? priority.color.replace('bg-', 'bg-') + ' border-current'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      )}
                    >
                      {priority.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newTicketForm.subject}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, subject: e.target.value })}
                  placeholder="Brief summary of the issue"
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={newTicketForm.description}
                  onChange={(e) => setNewTicketForm({ ...newTicketForm, description: e.target.value })}
                  placeholder="Provide detailed information about your issue..."
                  rows={6}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none"
                />
              </div>

              {/* Knowledge Base Suggestions */}
              {showKbSuggestions && kbSuggestions.length > 0 && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 p-6">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Before you submit, try these solutions</h3>
                      <p className="text-sm text-slate-600 mt-1">
                        We found some articles that might help resolve your issue
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowKbSuggestions(false)}
                      className="ml-auto p-1 hover:bg-blue-100 rounded transition-colors"
                    >
                      <X className="h-4 w-4 text-slate-600" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    {kbSuggestions.map(article => (
                      <button
                        key={article.id}
                        type="button"
                        onClick={() => openKBArticle(article.id)}
                        className="w-full bg-white rounded-lg p-4 text-left hover:shadow-md transition-all border-2 border-transparent hover:border-blue-300"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900 mb-1">{article.title}</p>
                            <p className="text-sm text-slate-600 line-clamp-2">{article.description}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs text-blue-600 font-medium">
                                {article.category.charAt(0).toUpperCase() + article.category.slice(1)}
                              </span>
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <Eye className="h-3 w-3" />
                                {article.views} views
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="h-5 w-5 text-blue-600 flex-shrink-0 mt-1" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Attachments */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Attachments (Optional)
                </label>
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center">
                  <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 mb-2">
                    Drop files here or click to upload
                  </p>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setAttachments(Array.from(e.target.files));
                      }
                    }}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="inline-block px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors"
                  >
                    Choose Files
                  </label>
                  {attachments.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg">
                          <span className="text-sm text-slate-700 flex items-center gap-2">
                            <Paperclip className="h-4 w-4" />
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !newTicketForm.category || !newTicketForm.subject || !newTicketForm.description}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-600 to-pink-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Create Ticket
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      {showDetailModal && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{selectedTicket.ticket_number}</h2>
                <p className="text-sm text-slate-600">{selectedTicket.subject}</p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status & Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Status</p>
                  <span className={'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ' + getStatusConfig(selectedTicket.status).color}>
                    {React.createElement(getStatusConfig(selectedTicket.status).icon, { className: "h-3.5 w-3.5" })}
                    {getStatusConfig(selectedTicket.status).label}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Priority</p>
                  <span className={'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ' + getPriorityBadge(selectedTicket.priority).color}>
                    {getPriorityBadge(selectedTicket.priority).label}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Category</p>
                  <p className="text-sm font-medium">{getCategoryLabel(selectedTicket.category)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Created</p>
                  <p className="text-sm font-medium">{new Date(selectedTicket.created_at).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Admin Actions */}
              {isAdmin && (
                <div className="flex flex-wrap gap-3 p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-200">
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-pink-500 text-pink-600 rounded-lg font-semibold hover:bg-pink-50 transition-colors"
                  >
                    <UserPlus className="h-4 w-4" />
                    {selectedTicket.assigned_to ? 'Reassign' : 'Assign'} Ticket
                  </button>
                  <button
                    onClick={() => setShowStatusModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-blue-500 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Change Status
                  </button>
                  {selectedTicket.assigned_to && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200">
                      <User className="h-4 w-4 text-slate-500" />
                      <span className="text-sm text-slate-700">
                        <span className="font-medium">Assigned to:</span> {selectedTicket.assigned_employee?.first_name} {selectedTicket.assigned_employee?.last_name}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Description</h3>
                <p className="text-slate-700 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {/* Attachments */}
              {ticketAttachments.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Attachments</h3>
                  <div className="space-y-2">
                    {ticketAttachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={attachment.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <Paperclip className="h-5 w-5 text-slate-400" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">{attachment.file_name}</p>
                          <p className="text-xs text-slate-500">
                            {(attachment.file_size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments Thread */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Comments ({comments.length})
                </h3>
                <div className="space-y-4 mb-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className={'rounded-xl p-4 ' + (comment.is_internal ? 'bg-yellow-50 border-2 border-yellow-200' : 'bg-slate-50')}>
                      <div className="flex items-start gap-3">
                        <div className={'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ' + (comment.is_internal ? 'bg-yellow-200' : 'bg-pink-100')}>
                          {comment.is_internal ? <Lock className="h-4 w-4 text-yellow-700" /> : <User className="h-4 w-4 text-pink-600" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-900">
                              {comment.employees.first_name} {comment.employees.last_name}
                            </span>
                            {comment.is_internal && (
                              <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs font-semibold rounded">
                                INTERNAL NOTE
                              </span>
                            )}
                            <span className="text-xs text-slate-500">
                              {formatDate(comment.created_at)}
                            </span>
                          </div>
                          <p className="text-slate-700 whitespace-pre-wrap">{comment.comment}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Comment Form */}
                {selectedTicket.status !== 'closed' && (
                  <form onSubmit={handleAddComment} className="space-y-3">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment..."
                      rows={3}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500 resize-none"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        {isAdmin && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isInternalComment}
                              onChange={(e) => setIsInternalComment(e.target.checked)}
                              className="rounded text-yellow-600 focus:ring-yellow-500"
                            />
                            <span className="text-sm font-medium text-slate-700 flex items-center gap-1">
                              <Lock className="h-4 w-4" />
                              Internal Note (Staff Only)
                            </span>
                          </label>
                        )}
                        {selectedTicket.status === 'resolved' && !isAdmin && (
                          <button
                            type="button"
                            onClick={handleReopenTicket}
                            className="px-4 py-2 border-2 border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50 transition-colors"
                          >
                            Reopen Ticket
                          </button>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={commentSubmitting || !newComment.trim()}
                        className="px-6 py-2 bg-gradient-to-r from-pink-600 to-pink-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {commentSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" />
                            Send {isInternalComment ? 'Internal Note' : 'Comment'}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin: Assign Ticket Modal */}
      {showAssignModal && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <UserPlus className="h-6 w-6 text-pink-600" />
              Assign Ticket
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Assign to Staff Member
                </label>
                <select
                  value={assignToId}
                  onChange={(e) => setAssignToId(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                >
                  <option value="">Select staff member...</option>
                  {staffMembers.map(staff => (
                    <option key={staff.id} value={staff.id}>
                      {staff.first_name} {staff.last_name} ({staff.employee_code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setAssignToId('');
                  }}
                  className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignTicket}
                  disabled={!assignToId}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-600 to-pink-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin: Change Status Modal */}
      {showStatusModal && selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-blue-600" />
              Change Ticket Status
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select status...</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="waiting_on_customer">Waiting on Customer</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {(newStatus === 'resolved' || newStatus === 'closed') && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Resolution Notes {newStatus === 'resolved' && '(Required)'}
                  </label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Describe how the issue was resolved..."
                    rows={4}
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setNewStatus('');
                    setResolutionNotes('');
                  }}
                  className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangeStatus}
                  disabled={!newStatus || (newStatus === 'resolved' && !resolutionNotes)}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Update Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </>
      )}

      {/* Alert Modal */}
      {alertModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center">
              {alertModal.type === 'success' && <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />}
              {alertModal.type === 'error' && <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />}
              {alertModal.type === 'warning' && <AlertTriangle className="h-16 w-16 text-orange-500 mx-auto mb-4" />}
              {alertModal.type === 'info' && <AlertCircle className="h-16 w-16 text-blue-500 mx-auto mb-4" />}
              
              <h3 className="text-xl font-bold text-slate-900 mb-2">{alertModal.title}</h3>
              <p className="text-slate-600 mb-6">{alertModal.message}</p>
              
              <button
                onClick={() => setAlertModal(null)}
                className="w-full px-6 py-3 bg-gradient-to-r from-pink-600 to-pink-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KB Article Modal */}
      {showKbArticleModal && selectedKbArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-6 w-6" />
                    <span className="text-sm font-semibold bg-white/20 px-3 py-1 rounded-full">
                      {selectedKbArticle.category.charAt(0).toUpperCase() + selectedKbArticle.category.slice(1)}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold">{selectedKbArticle.title}</h2>
                  <p className="text-blue-100 mt-2">{selectedKbArticle.description}</p>
                </div>
                <button
                  onClick={() => setShowKbArticleModal(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="flex items-center gap-4 text-sm text-blue-100">
                <div className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  {selectedKbArticle.views} views
                </div>
                {selectedKbArticle.author && (
                  <div>
                    By {selectedKbArticle.author.first_name} {selectedKbArticle.author.last_name}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-slate max-w-none">
                <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
                  {selectedKbArticle.content}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-200 p-6 bg-slate-50">
              <div className="flex gap-3">
                <button
                  onClick={() => setShowKbArticleModal(false)}
                  className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowKbArticleModal(false);
                    setShowKbSuggestions(false);
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle className="h-5 w-5" />
                  Problem Solved
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
