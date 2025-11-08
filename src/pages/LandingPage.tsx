import {
  ArrowRight,
  Clock,
  Users,
  DollarSign,
  BarChart3,
  Shield,
  Zap,
  Globe,
  CheckCircle,
  Star,
  TrendingUp,
  Briefcase,
  Calendar,
  FileText,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

export function LandingPage({ onGetStarted, onLogin }: LandingPageProps) {
  const features = [
    {
      icon: Users,
      title: 'Smart Employee Management',
      description: 'Centralize all employee data with intelligent profiles, automated onboarding, and seamless team collaboration.',
      color: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Clock,
      title: 'Location-Based Attendance',
      description: 'GPS-powered attendance tracking with geofencing, real-time check-ins, and comprehensive location reports.',
      color: 'from-violet-500 to-purple-500'
    },
    {
      icon: DollarSign,
      title: 'Automated Payroll',
      description: 'Intelligent salary processing with component breakdowns, tax calculations, and instant salary slips.',
      color: 'from-emerald-500 to-teal-500'
    },
    {
      icon: Calendar,
      title: 'Leave Management',
      description: 'Streamlined leave requests, approvals, and balance tracking with automated notifications.',
      color: 'from-orange-500 to-red-500'
    },
    {
      icon: BarChart3,
      title: 'Analytics & Reports',
      description: 'Real-time insights with interactive dashboards, custom reports, and predictive analytics.',
      color: 'from-pink-500 to-rose-500'
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Bank-grade encryption, role-based access, and compliance with global data protection standards.',
      color: 'from-indigo-500 to-blue-500'
    }
  ];

  const stats = [
    { label: 'Active Users', value: '50K+', icon: Users },
    { label: 'Companies Trust Us', value: '2,500+', icon: Briefcase },
    { label: 'Accuracy Rate', value: '99.9%', icon: CheckCircle },
    { label: 'Time Saved', value: '40%', icon: TrendingUp }
  ];

  const testimonials = [
    {
      name: 'Rajesh Kumar',
      role: 'HR Director',
      company: 'TechCorp India',
      image: 'RK',
      rating: 5,
      text: 'PulseHR transformed our HR operations. The location-based attendance and automated payroll saved us countless hours every month.'
    },
    {
      name: 'Priya Sharma',
      role: 'Operations Manager',
      company: 'Global Solutions Ltd',
      image: 'PS',
      rating: 5,
      text: 'The most intuitive HRMS we have used. Our employees love the self-service portal and the mobile-first design.'
    },
    {
      name: 'Amit Patel',
      role: 'CEO',
      company: 'StartupHub',
      image: 'AP',
      rating: 5,
      text: 'Scaled from 10 to 200+ employees seamlessly. PulseHR grew with us every step of the way.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-lg border-b border-slate-200 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                PulseHR
              </span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Features</a>
              <a href="#testimonials" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Testimonials</a>
              <a href="#pricing" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Pricing</a>
              <button
                onClick={onLogin}
                className="text-slate-600 hover:text-slate-900 font-medium transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={onGetStarted}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 glossy"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-fadeIn">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-600">AI-Powered HRMS Platform</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight">
                Transform Your
                <span className="block bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                  Workforce Management
                </span>
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed">
                The complete HR & Payroll solution that grows with your business. Automate attendance, streamline payroll, and empower your team with intelligent insights.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onGetStarted}
                  className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 glossy flex items-center justify-center gap-2"
                >
                  Start Free Trial
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={onLogin}
                  className="px-8 py-4 bg-white border-2 border-slate-300 text-slate-900 rounded-xl font-bold text-lg hover:border-blue-600 hover:text-blue-600 transition-all duration-300"
                >
                  Watch Demo
                </button>
              </div>
              <div className="flex items-center gap-6 pt-4">
                <div className="flex -space-x-2">
                  {['bg-blue-500', 'bg-violet-500', 'bg-pink-500', 'bg-emerald-500'].map((color, i) => (
                    <div key={i} className={`h-10 w-10 ${color} rounded-full border-2 border-white flex items-center justify-center text-white font-bold`}>
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex gap-1 mb-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-600">Trusted by 50,000+ users</p>
                </div>
              </div>
            </div>
            <div className="relative animate-float">
              <div className="relative z-10 bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl shadow-2xl p-8 border border-slate-700">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex gap-2">
                      <div className="h-3 w-3 rounded-full bg-red-500"></div>
                      <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                      <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    </div>
                    <span className="text-sm text-slate-400">Dashboard Overview</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Total Employees', value: '248', icon: Users, color: 'blue' },
                      { label: 'Present Today', value: '235', icon: CheckCircle, color: 'emerald' },
                      { label: 'On Leave', value: '8', icon: Calendar, color: 'orange' },
                      { label: 'Pending Tasks', value: '12', icon: FileText, color: 'violet' }
                    ].map((stat, i) => (
                      <div key={i} className="glass-dark rounded-xl p-4">
                        <div className={`h-10 w-10 bg-${stat.color}-500/20 rounded-lg flex items-center justify-center mb-3`}>
                          <stat.icon className={`h-5 w-5 text-${stat.color}-400`} />
                        </div>
                        <p className="text-2xl font-bold text-white mb-1">{stat.value}</p>
                        <p className="text-xs text-slate-400">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="glass-dark rounded-xl p-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-white">Recent Activity</span>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                    <div className="space-y-2">
                      {[
                        { name: 'John Doe', action: 'Checked In', time: '9:00 AM', color: 'emerald' },
                        { name: 'Sarah Smith', action: 'Leave Approved', time: '8:45 AM', color: 'blue' },
                        { name: 'Mike Johnson', action: 'Document Uploaded', time: '8:30 AM', color: 'violet' }
                      ].map((activity, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors">
                          <div className={`h-8 w-8 bg-${activity.color}-500/20 rounded-full flex items-center justify-center`}>
                            <span className={`text-xs font-bold text-${activity.color}-400`}>{activity.name[0]}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium truncate">{activity.name}</p>
                            <p className="text-xs text-slate-400">{activity.action}</p>
                          </div>
                          <span className="text-xs text-slate-500">{activity.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 w-full h-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 rounded-3xl blur-2xl"></div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center animate-scaleIn" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="h-16 w-16 bg-gradient-to-br from-blue-500 to-violet-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <stat.icon className="h-8 w-8 text-white" />
                </div>
                <p className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</p>
                <p className="text-sm text-slate-600 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full mb-6">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-600">Powerful Features</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Everything You Need to Manage Your Workforce
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Built for modern teams. Designed for growth. Powered by innovation.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group card-glossy rounded-2xl p-8 hover:shadow-2xl transition-all duration-300 cursor-pointer"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className={`h-14 w-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-lg`}>
                  <feature.icon className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                <button className="flex items-center gap-2 text-blue-600 font-semibold mt-4 group-hover:gap-3 transition-all">
                  Learn more
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-600 to-violet-600 text-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Loved by HR Teams Everywhere
            </h2>
            <p className="text-xl text-blue-100">
              See what our customers have to say about PulseHR
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <div key={i} className="glass rounded-2xl p-8 hover:scale-105 transition-transform duration-300">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-white/90 leading-relaxed mb-6">"{testimonial.text}"</p>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-gradient-to-br from-blue-400 to-violet-400 rounded-full flex items-center justify-center font-bold">
                    {testimonial.image}
                  </div>
                  <div>
                    <p className="font-bold text-white">{testimonial.name}</p>
                    <p className="text-sm text-blue-100">{testimonial.role}</p>
                    <p className="text-xs text-blue-200">{testimonial.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-slate-600 mb-12">
            Choose the plan that fits your business needs
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { name: 'Starter', price: '₹99', users: 'Up to 25 users', features: ['Core HRMS', 'Attendance', 'Leave Management', 'Email Support'] },
              { name: 'Professional', price: '₹199', users: 'Up to 100 users', features: ['Everything in Starter', 'Payroll Management', 'Reports & Analytics', 'Priority Support'], popular: true },
              { name: 'Enterprise', price: 'Custom', users: 'Unlimited users', features: ['Everything in Professional', 'Custom Integrations', 'Dedicated Manager', '24/7 Support'] }
            ].map((plan, i) => (
              <div key={i} className={`relative rounded-2xl p-8 border-2 ${plan.popular ? 'border-blue-600 shadow-2xl scale-105' : 'border-slate-200'} bg-white`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-bold rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                <p className="text-slate-600 mb-6">{plan.users}</p>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-slate-900">{plan.price}</span>
                  {plan.price !== 'Custom' && <span className="text-slate-600">/month</span>}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-3 text-slate-700">
                      <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={onGetStarted}
                  className={`w-full py-3 rounded-xl font-bold transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:shadow-xl'
                      : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Transform Your HR Operations?
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Join thousands of companies already using PulseHR to streamline their workforce management.
          </p>
          <button
            onClick={onGetStarted}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl font-bold text-lg hover:shadow-2xl hover:shadow-blue-500/50 transition-all duration-300 glossy inline-flex items-center gap-2"
          >
            Start Your Free Trial
            <ArrowRight className="h-5 w-5" />
          </button>
          <p className="text-sm text-slate-400 mt-4">No credit card required. 14-day free trial.</p>
        </div>
      </section>

      <footer className="bg-slate-900 border-t border-slate-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl flex items-center justify-center">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white">PulseHR</span>
              </div>
              <p className="text-slate-400 text-sm">
                The modern HRMS platform for forward-thinking companies.
              </p>
            </div>
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Demo', 'API'] },
              { title: 'Company', links: ['About', 'Careers', 'Blog', 'Contact'] },
              { title: 'Legal', links: ['Privacy', 'Terms', 'Security', 'Compliance'] }
            ].map((col, i) => (
              <div key={i}>
                <h4 className="font-bold text-white mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link, j) => (
                    <li key={j}>
                      <a href="#" className="text-slate-400 hover:text-white text-sm transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">© 2025 PulseHR. All rights reserved.</p>
            <div className="flex gap-4">
              {[Globe, Shield, Sparkles].map((Icon, i) => (
                <a key={i} href="#" className="h-10 w-10 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
