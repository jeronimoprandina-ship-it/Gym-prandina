import { Component, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { Firestore, collection, collectionData, addDoc, deleteDoc, doc, query, updateDoc, where } from '@angular/fire/firestore';
import { createUserWithEmailAndPassword, getIdTokenResult, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { Subscription } from 'rxjs';

interface Member {
  id: string;
  name: string;
  email: string;
  plan: string;
  expires: string;
  status: 'Pago' | 'No pago';
  routine: string;
  initials: string;
  color: string;
}

interface Routine {
  id?: string;
  name: string;
  level: string;
  duration: string;
  focus: string;
  exercises: number;
}

interface Membership {
  id: string;
  name: string;
  price: number;
  duration: string;
  description: string;
}

interface Exercise {
  id: number;
  name: string;
  description: string;
  category: { name: string };
  muscles: { name: string }[];
}

const muscleGroups = ['Todos', 'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Piernas', 'Glúteos', 'Core'];

interface ExerciseResponse {
  results: Exercise[];
}

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

interface PaymentReceipt {
  number: string;
  plan: string;
  amount: string;
  method: string;
  email: string;
  date: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class AppComponent {
  constructor(@Optional() private auth: Auth | null, @Optional() private firestore: Firestore | null, @Optional() private http: HttpClient | null) {
    document.body.dataset['view'] = 'Resumen';
    if (this.auth) {
      onAuthStateChanged(this.auth, async user => {
        this.currentUser = user;
        this.isAuthenticated = !!user;
        if (user && this.isAuthModalOpen) {
          this.isAuthModalOpen = false;
        }
        this.userRole = user ? await this.resolveUserRole(user) : this.resolveLocalRole();
        this.loadMembersForRole();
        this.applyRoleView();
        this.syncMemberPortal();
      });
    } else {
      this.isAuthenticated = true;
    }

    if (this.firestore) {
      collectionData(collection(this.firestore, 'routines'), { idField: 'id' }).subscribe(records => {
        if (records.length) this.routines = records as Routine[];
      });
    }
    this.loadExercises();
  }

  private activeViewValue = 'Resumen';
  get activeView() {
    return this.activeViewValue;
  }
  set activeView(value: string) {
    this.activeViewValue = value;
    if (typeof document !== 'undefined') document.body.dataset['view'] = value;
  }
  isMenuOpen = true;
  isAuthenticated = true;
  currentUser: { displayName?: string | null; email?: string | null } | null = null;
  userRole: 'admin' | 'socio' | null = 'admin';
  private membersSubscription?: Subscription;
  searchTerm = '';
  isMemberModalOpen = false;
  isRoutineModalOpen = false;
  isAuthModalOpen = false;
  authMode: 'choice' | 'login' | 'register' = 'choice';
  loginForm = { email: '', password: '' };
  registerForm = { name: '', email: '', password: '', confirmPassword: '' };
  authError = '';
  authSubmitting = false;
  isPaymentModalOpen = false;
  isReceiptModalOpen = false;
  isRoutineAdminModalOpen = false;
  isRoutineExerciseModalOpen = false;
  isMembershipModalOpen = false;
  editingRoutine: Routine | null = null;
  editingMembership: Membership | null = null;
  selectedRoutineForExercises: Routine | null = null;
  paymentPlan = '';
  paymentAmount = '';
  paymentMethod: 'Tarjeta' | 'Mercado Pago' = 'Tarjeta';
  paymentForm = { name: '', email: '', lastFour: '' };
  paymentError = '';
  paymentReceipt: PaymentReceipt | null = null;
  newRoutine = { name: '', level: 'Principiante', duration: '45 min', focus: 'Cuerpo completo', exercises: 8 };
  newMembership = { name: '', price: 0, duration: '', description: '' };
  selectedMember: Member | null = null;
  newMember = { name: '', email: '', plan: 'Plan mensual' };
  editingMember: Member | null = null;
  selectedSocioForDashboard: Member | null = null;
  socioDashboardTab: 'resumen' | 'ejercicios' | 'pagos' | 'rutina' = 'resumen';
  socioAccessMessage = '';
  apiSearch = '';
  apiCategory = 'Todas';
  apiExercises: Exercise[] = [];
  apiLoading = false;
  apiError = '';
  readonly weekDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  weekSchedule: Record<string, { name: string; exercises: number; focus: string }> = {
    'Lunes': { name: 'Pecho y Tríceps', exercises: 5, focus: 'Tren superior' },
    'Martes': { name: 'Espalda y Bíceps', exercises: 5, focus: 'Tren superior' },
    'Miércoles': { name: 'Piernas', exercises: 6, focus: 'Tren inferior' },
    'Jueves': { name: 'Hombros', exercises: 4, focus: 'Tren superior' },
    'Viernes': { name: 'Core', exercises: 3, focus: 'Abdominales' }
  };
  notificationsOpen = false;
  notifications: NotificationItem[] = [
    { id: 1, title: 'Membresía por vencer', message: 'Lucas Fernández vence dentro de 2 días.', time: 'Hace 10 min', read: false },
    { id: 2, title: 'Nueva rutina', message: 'Se asignó una nueva rutina a Valentina.', time: 'Hace 1 hora', read: false },
    { id: 3, title: 'API conectada', message: 'La base de ejercicios quedó sincronizada.', time: 'Hoy', read: true },
  ];

  readonly summaryMetrics = {
    income: 1240000,
    expenses: 480000,
    net: 760000,
    attendance: 84,
    adherence: 72,
    retention: 91
  };

  get unreadNotifications() {
    return this.notifications.filter(item => !item.read).length;
  }

  get isAdmin() {
    return this.userRole === 'admin';
  }

  private async resolveUserRole(user: { email?: string | null; getIdTokenResult?: () => Promise<unknown> }): Promise<'admin' | 'socio'> {
    try {
      const tokenResult = await getIdTokenResult(user as Parameters<typeof getIdTokenResult>[0]);
      const role = tokenResult.claims['role'];
      if (role === 'admin' || role === 'socio') return role;
    } catch {
      // Use the compatibility rule below when custom claims are unavailable.
    }
    return user.email?.toLowerCase().endsWith('@admin.com') ? 'admin' : 'socio';
  }

  private resolveLocalRole(): 'admin' | 'socio' {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('rol') === 'socio') {
      return 'socio';
    }
    return 'admin';
  }

  private applyRoleView() {
    if (this.userRole === 'socio') {
      this.activeView = 'Mi Portal';
    } else if (this.userRole === 'admin' && this.activeView === 'Mi Portal') {
      this.activeView = 'Resumen';
    }
  }

  private syncMemberPortal() {
    if (this.userRole !== 'socio') return;
    const localEmail = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('email') : null;
    const memberEmail = this.currentUser?.email || localEmail;
    const member = memberEmail
      ? this.members.find(item => item.email.toLowerCase() === memberEmail.toLowerCase())
      : this.members[0];
    this.selectedSocioForDashboard = member ?? null;
    this.socioAccessMessage = member ? '' : 'Tu cuenta todavía no está asociada a un socio. Consultá al administrador.';
    this.socioDashboardTab = 'resumen';
  }

  private loadMembersForRole() {
    if (!this.firestore || !this.currentUser?.email) return;
    this.membersSubscription?.unsubscribe();
    const membersCollection = collection(this.firestore, 'members');
    const membersQuery = this.isAdmin
      ? membersCollection
      : query(membersCollection, where('email', '==', this.currentUser.email.toLowerCase()));
    this.membersSubscription = collectionData(membersQuery, { idField: 'id' }).subscribe(records => {
      this.members = records as Member[];
      this.syncMemberPortal();
    });
  }

  get incomeDisplay() {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(this.summaryMetrics.income);
  }

  get expensesDisplay() {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(this.summaryMetrics.expenses);
  }

  get netDisplay() {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(this.summaryMetrics.net);
  }

  get attendanceProgress() {
    return Math.min(this.summaryMetrics.attendance, 100);
  }

  openSocioPortal(member: Member) {
    if (!this.isAdmin && member.email.toLowerCase() !== this.currentUser?.email?.toLowerCase()) return;
    this.selectedSocioForDashboard = member;
    this.socioDashboardTab = 'resumen';
    this.activeView = 'Mi Portal';
  }

  closeSocioPortal() {
    if (!this.isAdmin) return;
    this.selectedSocioForDashboard = null;
    this.socioDashboardTab = 'resumen';
    this.activeView = 'Resumen';
  }

  setSocioDashboardTab(tab: 'resumen' | 'ejercicios' | 'pagos' | 'rutina') {
    this.socioDashboardTab = tab;
  }

  toggleNotifications() {
    this.notificationsOpen = !this.notificationsOpen;
  }

  markNotificationRead(id: number) {
    this.notifications = this.notifications.map(item => item.id === id ? { ...item, read: true } : item);
  }

  clearNotifications() {
    this.notifications = this.notifications.map(item => ({ ...item, read: true }));
  }

  openPaymentModal(plan: string, amount: string, method: 'Tarjeta' | 'Mercado Pago') {
    this.paymentPlan = plan;
    this.paymentAmount = amount;
    this.paymentMethod = method;
    this.paymentError = '';
    this.isPaymentModalOpen = true;
  }

  confirmPayment() {
    this.paymentError = '';
    if (!this.paymentForm.name.trim() || !this.paymentForm.email.includes('@')) {
      this.paymentError = 'Completá tu nombre y un correo válido.';
      return;
    }
    if (this.paymentMethod === 'Tarjeta' && !/^\d{4}$/.test(this.paymentForm.lastFour)) {
      this.paymentError = 'Ingresá los últimos 4 números de la tarjeta.';
      return;
    }
    this.paymentReceipt = {
      number: `GP-${Date.now().toString().slice(-8)}`,
      plan: this.paymentPlan,
      amount: this.paymentAmount,
      method: this.paymentMethod,
      email: this.paymentForm.email.trim().toLowerCase(),
      date: new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())
    };
    this.isPaymentModalOpen = false;
    this.isReceiptModalOpen = true;
  }

  downloadReceipt() {
    if (!this.paymentReceipt) return;
    const receipt = this.paymentReceipt;
    const content = `PRANDINA PERFORMANCE LAB\nComprobante de pago\n\nNúmero: ${receipt.number}\nPlan: ${receipt.plan}\nImporte: ${receipt.amount}\nMedio de pago: ${receipt.method}\nCorreo: ${receipt.email}\nFecha: ${receipt.date}`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    link.download = `${receipt.number}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  emailReceipt() {
    if (!this.paymentReceipt) return;
    const receipt = this.paymentReceipt;
    const subject = encodeURIComponent(`Comprobante Prandina Performance Lab ${receipt.number}`);
    const body = encodeURIComponent(`Tu pago fue registrado.\n\nPlan: ${receipt.plan}\nImporte: ${receipt.amount}\nMedio de pago: ${receipt.method}\nNúmero: ${receipt.number}\nFecha: ${receipt.date}`);
    window.location.href = `mailto:${receipt.email}?subject=${subject}&body=${body}`;
  }

  openRoutineAdmin(routine: Routine | null = null) {
    this.editingRoutine = routine;
    this.newRoutine = routine
      ? { name: routine.name, level: routine.level, duration: routine.duration, focus: routine.focus, exercises: routine.exercises }
      : { name: '', level: 'Principiante', duration: '45 min', focus: 'Cuerpo completo', exercises: 8 };
    this.isRoutineAdminModalOpen = true;
  }

  async saveRoutine() {
    if (!this.newRoutine.name.trim()) return;
    const routine = { ...this.newRoutine, name: this.newRoutine.name.trim() };
    if (this.firestore) {
      if (this.editingRoutine?.id) {
        await updateDoc(doc(this.firestore, 'routines', this.editingRoutine.id), routine);
      } else {
        await addDoc(collection(this.firestore, 'routines'), routine);
      }
    } else if (this.editingRoutine) {
      Object.assign(this.editingRoutine, routine);
    } else {
      this.routines = [{ ...routine, id: Date.now().toString() }, ...this.routines];
    }
    this.editingRoutine = null;
    this.isRoutineAdminModalOpen = false;
  }

  async deleteRoutine(routine: Routine) {
    if (!confirm(`¿Eliminar la rutina ${routine.name}?`)) return;
    if (this.firestore && routine.id) {
      await deleteDoc(doc(this.firestore, 'routines', routine.id));
    } else {
      this.routines = this.routines.filter(item => item.name !== routine.name || item.duration !== routine.duration);
    }
  }

  openRoutineExercises(routine: Routine) {
    this.selectedRoutineForExercises = routine;
    this.isRoutineExerciseModalOpen = true;
  }

  managePayment(member: Member) {
    const amountMap: Record<string, string> = {
      'Plan mensual': '$15.000',
      'Plan trimestral': '$40.000',
      'Plan anual': '$140.000'
    };
    this.openPaymentModal(member.plan, amountMap[member.plan] || '$15.000', 'Tarjeta');
  }

  openMembershipAdmin(membership: Membership | null = null) {
    this.editingMembership = membership;
    this.newMembership = membership
      ? { name: membership.name, price: membership.price, duration: membership.duration, description: membership.description }
      : { name: '', price: 0, duration: '', description: '' };
    this.isMembershipModalOpen = true;
  }

  saveMembership() {
    if (!this.newMembership.name.trim() || this.newMembership.price <= 0) return;
    const membership = { ...this.newMembership, name: this.newMembership.name.trim() };
    if (this.editingMembership) {
      Object.assign(this.editingMembership, membership);
    } else {
      this.memberships.push({ id: `${Date.now()}`, ...membership });
    }
    this.editingMembership = null;
    this.isMembershipModalOpen = false;
  }

  deleteMembership(membership: Membership) {
    if (!confirm(`¿Eliminar ${membership.name}?`)) return;
    this.memberships = this.memberships.filter(item => item.id !== membership.id);
  }

  get memberMembership(): Membership | undefined {
    return this.memberships.find(membership => membership.name === this.selectedSocioForDashboard?.plan);
  }

  get memberAssignedRoutine(): Routine | undefined {
    return this.routines.find(routine => routine.name === this.selectedSocioForDashboard?.routine);
  }

  get activeMembersCount() {
    return this.members.filter(member => member.status === 'Pago').length;
  }

  get monthlyExpensesValue() {
    return this.summaryMetrics.expenses;
  }

  get expiringMembersCount() {
    return this.members.filter(member => member.status === 'No pago').length;
  }

  get assignedRoutinesCount() {
    return this.members.filter(member => member.routine !== 'Sin asignar').length;
  }

  get currentDateLabel(): string {
    const now = new Date();
    const weekday = new Intl.DateTimeFormat('es-AR', { weekday: 'long' }).format(now).toUpperCase();
    const day = now.getDate();
    const month = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(now).toUpperCase();
    const year = now.getFullYear();
    return `${weekday}, ${day} DE ${month} DE ${year}`;
  }

  routines: Routine[] = [
    { name: 'Fuerza inicial', level: 'Principiante', duration: '45 min', focus: 'Cuerpo completo', exercises: 8 },
    { name: 'Hipertrofia superior', level: 'Intermedio', duration: '60 min', focus: 'Tren superior', exercises: 10 },
    { name: 'Acondicionamiento', level: 'Avanzado', duration: '40 min', focus: 'Cardio y core', exercises: 7 },
  ];

  members: Member[] = [
    { id: '1', name: 'Sofía Martínez', email: 'sofia.martinez@email.com', plan: 'Plan mensual', expires: '28 ago 2026', status: 'Pago', routine: 'Hipertrofia superior', initials: 'SM', color: '#e7c6a5' },
    { id: '2', name: 'Lucas Fernández', email: 'lucas.fernandez@email.com', plan: 'Plan trimestral', expires: '24 ago 2026', status: 'No pago', routine: 'Fuerza inicial', initials: 'LF', color: '#b8d8d8' },
    { id: '3', name: 'Valentina Rojas', email: 'valentina.rojas@email.com', plan: 'Plan mensual', expires: '15 sep 2026', status: 'Pago', routine: 'Acondicionamiento', initials: 'VR', color: '#d7c6e5' },
    { id: '4', name: 'Mateo Silva', email: 'mateo.silva@email.com', plan: 'Plan mensual', expires: '02 ago 2026', status: 'No pago', routine: 'Sin asignar', initials: 'MS', color: '#f0c7c0' },
  ];

  memberships: Membership[] = [
    { id: '1', name: 'Plan mensual', price: 15000, duration: '30 días', description: 'Acceso ilimitado a todas las instalaciones' },
    { id: '2', name: 'Plan trimestral', price: 39000, duration: '90 días', description: 'Acceso ilimitado + 1 clase grupal gratis' },
    { id: '3', name: 'Plan anual', price: 150000, duration: '365 días', description: 'Acceso ilimitado + clases + asesoramiento' }
  ];

  get userInitials() {
    const source = this.currentUser?.displayName || this.currentUser?.email || 'Usuario';
    const initials = source
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('');
    return initials || 'U';
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  get filteredMembers() {
    const term = this.searchTerm.toLowerCase().trim();
    return this.members.filter(member => member.name.toLowerCase().includes(term) || member.email.toLowerCase().includes(term));
  }

  get exerciseCategories() {
    return muscleGroups;
  }

  getExerciseGroups(exercise: Exercise): string[] {
    const muscleNames = [exercise.name, exercise.category?.name, ...(exercise.muscles ?? []).map(muscle => muscle.name)].join(' ').toLowerCase();
    const groups: string[] = [];
    if (/chest|pectoral|pecho/.test(muscleNames)) groups.push('Pecho');
    if (/back|latissimus|dorsal|espalda/.test(muscleNames)) groups.push('Espalda');
    if (/shoulder|deltoid|hombro/.test(muscleNames)) groups.push('Hombros');
    if (/biceps|bíceps/.test(muscleNames)) groups.push('Bíceps');
    if (/triceps|tríceps/.test(muscleNames)) groups.push('Tríceps');
    if (/quadriceps|quad|hamstring|calf|leg|pierna|cuádriceps|femoral|pantorrilla/.test(muscleNames)) groups.push('Piernas');
    if (/glute|glúteo/.test(muscleNames)) groups.push('Glúteos');
    if (/abdom|core|oblique|lumbar|abdomen|\babs\b/.test(muscleNames)) groups.push('Core');
    if (/\barms\b/.test(muscleNames) && !groups.includes('Bíceps') && !groups.includes('Tríceps')) groups.push('Bíceps', 'Tríceps');
    return groups.length ? [...new Set(groups)] : ['General'];
  }

  getExerciseName(exercise: Exercise): string {
    const originalName = (exercise.name ?? '').trim();
    const name = originalName.toLowerCase();
    const translations: [RegExp, string][] = [
      [/bench press|barbell bench|chest press|press de banca/, 'Press de banca'],
      [/push.?up|pushup|flexion/, 'Flexiones de pecho'],
      [/chest fly|cable fly|pec deck|apertura/, 'Aperturas de pecho'],
      [/incline press/, 'Press inclinado'],
      [/deadlift|peso muerto/, 'Peso muerto'],
      [/squat|sentadilla/, 'Sentadilla'],
      [/leg press|prensa/, 'Prensa de piernas'],
      [/leg extension|extensión de pierna/, 'Extensión de piernas'],
      [/leg curl|femoral/, 'Curl femoral'],
      [/lunge|zancada/, 'Zancadas'],
      [/hip thrust|glute bridge|puente de glúteos/, 'Hip thrust'],
      [/calf raise|pantorrilla/, 'Elevación de pantorrillas'],
      [/shoulder press|military press|press militar/, 'Press militar'],
      [/lateral raise|elevación lateral/, 'Elevaciones laterales'],
      [/front raise|elevación frontal/, 'Elevaciones frontales'],
      [/pull.?up|chin.?up|dominada/, 'Dominadas'],
      [/lat pull|jalón/, 'Jalón al pecho'],
      [/barbell row|cable row|remo/, 'Remo'],
      [/biceps curl|barbell curl|curl/, 'Curl de bíceps'],
      [/triceps extension|triceps pushdown|extensión de tríceps/, 'Extensión de tríceps'],
      [/dip|fondo/, 'Fondos de tríceps'],
      [/crunch|sit.?up|abdominal/, 'Abdominales'],
      [/plank|plancha/, 'Plancha']
    ];
    const translation = translations.find(([pattern]) => pattern.test(name));
    if (translation) {
      const variants: Record<string, string[]> = {
        'Press de banca': ['con barra', 'con mancuernas', 'inclinado', 'declinado', 'con agarre cerrado'],
        'Aperturas de pecho': ['con mancuernas', 'en polea', 'inclinadas'],
        'Press militar': ['con barra', 'con mancuernas', 'sentado'],
        'Remo': ['con barra', 'con mancuernas', 'en polea'],
        'Sentadilla': ['libre', 'frontal', 'sumo', 'con mancuernas'],
        'Curl de bíceps': ['con barra', 'alternado', 'martillo', 'concentrado'],
        'Extensión de tríceps': ['en polea', 'sobre la cabeza', 'con mancuerna'],
        'Abdominales': ['cortos', 'con piernas elevadas', 'en bicicleta']
      };
      const options = variants[translation[1]];
      return options ? `${translation[1]} ${options[exercise.id % options.length]}` : translation[1];
    }
    if (originalName) return originalName.charAt(0).toUpperCase() + originalName.slice(1);

    const fallbackNames: Record<string, string[]> = {
      Pecho: ['Press de banca', 'Aperturas con mancuernas', 'Press inclinado'],
      Espalda: ['Remo con barra', 'Jalón al pecho', 'Dominadas'],
      Hombros: ['Press militar', 'Elevaciones laterales', 'Elevaciones frontales'],
      Bíceps: ['Curl de bíceps con barra', 'Curl alternado', 'Curl martillo'],
      Tríceps: ['Extensión de tríceps', 'Fondos de tríceps', 'Press cerrado'],
      Piernas: ['Sentadilla', 'Prensa de piernas', 'Extensión de piernas'],
      Glúteos: ['Hip thrust', 'Puente de glúteos', 'Patada de glúteo'],
      Core: ['Abdominales', 'Plancha', 'Elevación de piernas'],
      General: ['Ejercicio funcional']
    };
    const group = this.getExerciseGroups(exercise)[0] || 'General';
    const names = fallbackNames[group] || fallbackNames['General'];
    return names[exercise.id % names.length];
  }

  getExerciseDescription(exercise: Exercise): string {
    const cleanDescription = (exercise.description ?? '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanDescription) return cleanDescription;
    return `Realizá ${this.getExerciseName(exercise).toLowerCase()} con movimiento controlado, espalda estable y respiración constante.`;
  }

  get filteredExercises() {
    const term = this.apiSearch.toLowerCase().trim();
    const matchingExercises = this.apiExercises.filter(exercise => {
      const searchableText = [this.getExerciseName(exercise), exercise.name, exercise.description, ...(exercise.muscles ?? []).map(muscle => muscle.name)].join(' ').toLowerCase();
      const matchesText = searchableText.includes(term);
      const matchesCategory = this.apiCategory === 'Todos' || this.getExerciseGroups(exercise).includes(this.apiCategory);
      return matchesText && matchesCategory;
    });
    const namesShown = new Set<string>();
    return matchingExercises.filter(exercise => {
      const name = this.getExerciseName(exercise).toLowerCase();
      if (namesShown.has(name)) return false;
      namesShown.add(name);
      return true;
    });
  }

  loadExercises() {
    if (!this.http) return;
    this.apiLoading = true;
    this.http.get<ExerciseResponse>('https://wger.de/api/v2/exerciseinfo/?language=2&limit=100').subscribe({
      next: response => {
        this.apiExercises = response.results ?? [];
        this.apiLoading = false;
      },
      error: () => {
        this.apiError = 'No se pudieron cargar los ejercicios. Revisá tu conexión.';
        this.apiLoading = false;
      }
    });
  }

  openAuthModal(mode: 'choice' | 'login' | 'register') {
    this.authMode = mode;
    this.authError = '';
    this.isAuthModalOpen = true;
  }

  private normalizeEmail(value: string) {
    return value.trim().toLowerCase();
  }

  async submitAuth() {
    this.authError = '';
    this.authSubmitting = true;
    if (!this.auth) {
      this.authError = 'Firebase Authentication no está disponible.';
      this.authSubmitting = false;
      return;
    }
    try {
      const email = this.authMode === 'login'
        ? this.normalizeEmail(this.loginForm.email)
        : this.normalizeEmail(this.registerForm.email);
      if (!email || !email.includes('@')) {
        this.authError = 'Ingresá un correo electrónico válido.';
        return;
      }
      const authOperation = async () => {
        if (this.authMode === 'login') {
          await signInWithEmailAndPassword(this.auth!, email, this.loginForm.password);
        } else {
          if (this.registerForm.name.trim().length < 2) {
            this.authError = 'Ingresá tu nombre completo.';
            return;
          }
          if (this.registerForm.password.length < 6) {
            this.authError = 'La contraseña debe tener al menos 6 caracteres.';
            return;
          }
          if (this.registerForm.password !== this.registerForm.confirmPassword) {
            this.authError = 'Las contraseñas no coinciden.';
            return;
          }
          const credentials = await createUserWithEmailAndPassword(this.auth!, email, this.registerForm.password);
          await updateProfile(credentials.user, { displayName: this.registerForm.name.trim() });
        }
      };
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('auth-timeout')), 10000);
      });
      await Promise.race([authOperation(), timeout]);
      this.isAuthModalOpen = false;
    } catch (error: unknown) {
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code: string }).code)
        : error instanceof Error ? error.message : '';
      if (code.includes('auth/operation-not-allowed')) {
        this.authError = 'Firebase no tiene habilitado el acceso por correo y contraseña.';
      } else if (code.includes('auth/email-already-in-use')) {
        this.authError = 'Ese correo ya está registrado. Iniciá sesión.';
      } else if (code.includes('auth/invalid-credential') || code.includes('auth/wrong-password') || code.includes('auth/user-not-found')) {
        this.authError = 'El correo o la contraseña no son correctos.';
      } else if (code.includes('auth/weak-password')) {
        this.authError = 'La contraseña debe tener al menos 6 caracteres.';
      } else if (code.includes('auth/invalid-email')) {
        this.authError = 'Ingresá un correo electrónico válido.';
      } else if (code.includes('auth-timeout')) {
        this.authError = 'Firebase está tardando demasiado. Revisá tu conexión e intentá nuevamente.';
      } else {
        this.authError = 'No se pudo conectar con Firebase. Revisá la configuración e intentá nuevamente.';
      }
    } finally {
      this.authSubmitting = false;
    }
  }

  async logout() {
    if (this.auth) {
      await signOut(this.auth);
    }
    this.currentUser = null;
    this.isAuthenticated = false;
  }

  openRoutineModal(member: Member) {
    this.selectedMember = member;
    this.isRoutineModalOpen = true;
  }

  assignRoutine(routine: Routine) {
    if (this.selectedMember) {
      this.selectedMember.routine = routine.name;
      if (this.firestore && this.selectedMember.id) {
        updateDoc(doc(this.firestore, 'members', this.selectedMember.id), { routine: routine.name }).catch(() => undefined);
      }
    }
    this.isRoutineModalOpen = false;
  }

  openMemberModal(member: Member | null = null) {
    this.editingMember = member;
    this.newMember = member
      ? { name: member.name, email: member.email, plan: member.plan }
      : { name: '', email: '', plan: 'Plan mensual' };
    this.isMemberModalOpen = true;
  }

  async saveMember() {
    if (!this.newMember.name || !this.newMember.email) return;
    const nameParts = this.newMember.name.trim().split(' ');
    const memberData = {
      name: this.newMember.name, email: this.newMember.email,
      plan: this.newMember.plan, expires: '21 sep 2026', status: 'Pago', routine: 'Sin asignar',
      initials: `${nameParts[0]?.[0] ?? ''}${nameParts[1]?.[0] ?? ''}`.toUpperCase(), color: '#c7d9b7'
    } as const;
    if (this.firestore) {
      if (this.editingMember?.id) await updateDoc(doc(this.firestore, 'members', this.editingMember.id), memberData);
      else await addDoc(collection(this.firestore, 'members'), memberData);
    } else if (this.editingMember) {
      Object.assign(this.editingMember, memberData);
    } else {
      this.members.unshift({ id: Date.now().toString(), ...memberData });
    }
    this.newMember = { name: '', email: '', plan: 'Plan mensual' };
    this.editingMember = null;
    this.isMemberModalOpen = false;
  }

  async removeMember(member: Member) {
    if (!confirm(`¿Eliminar a ${member.name}?`)) return;
    if (this.firestore && member.id) await deleteDoc(doc(this.firestore, 'members', member.id));
    else this.members = this.members.filter(item => item.id !== member.id);
  }
}
