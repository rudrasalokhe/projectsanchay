/**
 * Project Sanchay — Frontend Application Controller
 * Manages views, role routing, state updates, modals, and real-time backend synchronization.
 */

class App {
  constructor() {
    this.currentView = 'landing';
    this.activeRole = null;
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.checkAuthStatus();

    // Check if URL has a verification token, e.g. /verify?token=... or #token
    const urlParams = new URLSearchParams(window.location.search);
    const verifyToken = urlParams.get('token');
    if (verifyToken) {
      document.getElementById('verify-token-input').value = verifyToken;
      this.navigate('verify');
      this.executePublicVerify(verifyToken);
    }
  }

  setupEventListeners() {
    window.addEventListener('auth:expired', () => {
      this.toast('Session expired. Please sign in again.', 'warning');
      this.renderAuthState();
      this.navigate('landing');
    });

    window.addEventListener('auth:logout', () => {
      this.toast('Logged out successfully', 'info');
      this.renderAuthState();
      this.navigate('landing');
    });
  }

  // --- TOAST NOTIFICATIONS ---
  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    const icons = {
      success: '<i class="fa-solid fa-circle-check text-emerald-500"></i>',
      error: '<i class="fa-solid fa-circle-xmark text-rose-500"></i>',
      warning: '<i class="fa-solid fa-triangle-exclamation text-amber-500"></i>',
      info: '<i class="fa-solid fa-circle-info text-blue-500"></i>',
    };

    const borderColors = {
      success: 'border-emerald-200 bg-white',
      error: 'border-rose-200 bg-white',
      warning: 'border-amber-200 bg-white',
      info: 'border-blue-200 bg-white',
    };

    toast.className = `toast-item px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-sm font-medium text-slate-800 ${borderColors[type] || borderColors.info}`;
    toast.innerHTML = `
      ${icons[type] || icons.info}
      <span class="flex-grow">${message}</span>
      <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 ml-2">
        <i class="fa-solid fa-xmark text-xs"></i>
      </button>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  }

  // --- MODAL CONTROLLERS ---
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  }

  // --- AUTHENTICATION & DEMO LOGIN ---
  async checkAuthStatus() {
    if (window.api.isAuthenticated()) {
      try {
        const user = await window.api.getMe();
        this.activeRole = user.role;
        this.renderAuthState();
        this.navigateRoleDefault(user.role);
      } catch (err) {
        window.api.clearSession();
        this.renderAuthState();
      }
    } else {
      this.renderAuthState();
    }
  }

  renderAuthState() {
    const isAuth = window.api.isAuthenticated();
    const user = window.api.currentUser;

    document.getElementById('auth-buttons').classList.toggle('hidden', isAuth);
    document.getElementById('user-menu').classList.toggle('hidden', !isAuth);

    if (isAuth && user) {
      document.getElementById('user-fullname').textContent = user.fullName;
      const roleBadge = document.getElementById('user-role-badge');
      roleBadge.textContent = user.role;
      roleBadge.className = `text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 role-pill-${user.role.toLowerCase()}`;
    }

    this.renderNavLinks();
  }

  renderNavLinks() {
    const nav = document.getElementById('nav-links');
    const role = window.api.getUserRole();

    let html = `
      <button onclick="app.navigate('landing')" class="px-3 py-1.5 rounded-lg text-slate-600 hover:text-brand-700 hover:bg-slate-100 transition">
        Overview
      </button>
    `;

    if (role === 'COLLECTOR') {
      html += `
        <button onclick="app.navigate('collector')" class="px-3 py-1.5 rounded-lg text-brand-700 font-bold bg-teal-50 hover:bg-teal-100 transition">
          <i class="fa-solid fa-truck-pickup mr-1"></i> Collector Dashboard
        </button>
      `;
    } else if (role === 'RECYCLER') {
      html += `
        <button onclick="app.navigate('recycler')" class="px-3 py-1.5 rounded-lg text-brand-700 font-bold bg-teal-50 hover:bg-teal-100 transition">
          <i class="fa-solid fa-recycle mr-1"></i> Recycler Operations
        </button>
      `;
    } else if (role === 'BRAND') {
      html += `
        <button onclick="app.navigate('brand')" class="px-3 py-1.5 rounded-lg text-indigo-700 font-bold bg-indigo-50 hover:bg-indigo-100 transition">
          <i class="fa-solid fa-chart-line mr-1"></i> Brand Analytics
        </button>
      `;
    } else if (role === 'ADMIN') {
      html += `
        <button onclick="app.navigate('admin')" class="px-3 py-1.5 rounded-lg text-rose-700 font-bold bg-rose-50 hover:bg-rose-100 transition">
          <i class="fa-solid fa-shield-halved mr-1"></i> Admin Center
        </button>
      `;
    }

    nav.innerHTML = html;
  }

  navigateRoleDefault(role) {
    if (role === 'COLLECTOR') this.navigate('collector');
    else if (role === 'RECYCLER') this.navigate('recycler');
    else if (role === 'BRAND') this.navigate('brand');
    else if (role === 'ADMIN') this.navigate('admin');
    else this.navigate('landing');
  }

  navigate(viewId) {
    this.currentView = viewId;
    document.querySelectorAll('.view-panel').forEach((el) => el.classList.add('hidden'));

    const target = document.getElementById(`view-${viewId}`);
    if (target) target.classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Load data for active view
    if (viewId === 'collector') this.loadCollectorData();
    else if (viewId === 'recycler') this.loadRecyclerData();
    else if (viewId === 'brand') this.loadBrandData();
    else if (viewId === 'admin') this.loadAdminData();
  }

  openAuthModal(mode = 'login') {
    this.switchAuthMode(mode);
    this.openModal('modal-auth');
  }

  switchAuthMode(mode) {
    const isLogin = mode === 'login';
    document.getElementById('form-login').classList.toggle('hidden', !isLogin);
    document.getElementById('form-register').classList.toggle('hidden', isLogin);
    document.getElementById('auth-modal-title').textContent = isLogin ? 'Sign in to Sanchay' : 'Register for Sanchay';
    document.getElementById('auth-modal-subtitle').textContent = isLogin
      ? 'Access your role dashboard and transactions'
      : 'Connect to India’s formal e-waste chain of custody';
  }

  toggleRecyclerFields(role) {
    document.getElementById('reg-recycler-extra').classList.toggle('hidden', role !== 'RECYCLER');
  }

  async quickLogin(email) {
    try {
      this.toast(`Authenticating as ${email}...`, 'info');
      await window.api.login(email, 'Password123!');
      this.renderAuthState();
      this.toast(`Welcome back! Logged in as ${window.api.currentUser.role}`, 'success');
      this.navigateRoleDefault(window.api.currentUser.role);
    } catch (err) {
      this.toast(`Login failed: ${err.message}`, 'error');
    }
  }

  async handleLoginSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      await window.api.login(email, password);
      this.closeModal('modal-auth');
      this.renderAuthState();
      this.toast(`Welcome back, ${window.api.currentUser.fullName}!`, 'success');
      this.navigateRoleDefault(window.api.currentUser.role);
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  async handleRegisterSubmit(event) {
    event.preventDefault();
    const data = {
      fullName: document.getElementById('reg-name').value,
      email: document.getElementById('reg-email').value,
      phone: document.getElementById('reg-phone').value,
      password: document.getElementById('reg-password').value,
      role: document.getElementById('reg-role').value,
      city: document.getElementById('reg-city').value,
      state: document.getElementById('reg-state').value,
    };

    if (data.role === 'RECYCLER') {
      data.companyName = document.getElementById('reg-company').value;
      data.registrationNumber = document.getElementById('reg-regnumber').value;
    }

    try {
      await window.api.register(data);
      this.closeModal('modal-auth');
      this.renderAuthState();
      this.toast('Registration successful!', 'success');
      this.navigateRoleDefault(window.api.currentUser.role);
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  async logout() {
    await window.api.logout();
  }

  // =========================================================================
  // 2. COLLECTOR MODULE
  // =========================================================================

  async loadCollectorData() {
    await Promise.all([this.loadCollectorKPIs(), this.loadCollectorListings(), this.loadCollectorTransactions()]);
  }

  async loadCollectorKPIs() {
    try {
      const data = await window.api.getCollectorDashboard();
      const overview = data.overview;

      document.getElementById('collector-kpis').innerHTML = `
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Active Waste Listings</p>
          <p class="text-2xl font-bold text-slate-900">${overview.availableListings} <span class="text-xs font-normal text-slate-500">/ ${overview.totalListings} total</span></p>
          <span class="inline-block mt-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Available in Market</span>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Reserved In Handover</p>
          <p class="text-2xl font-bold text-amber-600">${overview.reservedListings}</p>
          <span class="inline-block mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Pending Verification</span>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Documented Weight</p>
          <p class="text-2xl font-bold text-teal-700">${overview.totalWeightCollectedKg} <span class="text-xs font-normal text-slate-500">kg</span></p>
          <span class="inline-block mt-2 text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">Traceable Chain</span>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Gross Handover Value</p>
          <p class="text-2xl font-bold text-slate-900">₹${overview.totalGrossEarnings}</p>
          <span class="inline-block mt-2 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">${overview.verifiedHandoversCount} Verified Handovers</span>
        </div>
      `;
    } catch (err) {
      console.error(err);
    }
  }

  async loadCollectorListings() {
    const container = document.getElementById('collector-listings-container');
    container.innerHTML = '<div class="col-span-full py-8 text-center text-slate-400">Loading listings...</div>';

    try {
      const res = await window.api.getMyListings();
      const listings = res.items || [];

      if (listings.length === 0) {
        container.innerHTML = `
          <div class="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <i class="fa-solid fa-boxes-stacked text-3xl text-slate-300 mb-3"></i>
            <h4 class="font-bold text-slate-700">No Listings Created Yet</h4>
            <p class="text-xs text-slate-500 mb-4">Post electronic scrap materials to receive bids from authorized recyclers.</p>
            <button onclick="app.openCreateListingModal()" class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-700 hover:bg-brand-800">
              Create First Listing
            </button>
          </div>
        `;
        return;
      }

      container.innerHTML = listings
        .map((item) => {
          const statusClass = `badge-${item.status.toLowerCase()}`;
          const isAvailable = item.status === 'AVAILABLE';

          return `
            <div class="bg-white rounded-2xl border border-slate-200 p-5 hover-card-lift flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between gap-2 mb-2">
                  <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusClass}">
                    ${item.status}
                  </span>
                  <span class="text-xs text-slate-400 font-medium">
                    ${new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h4 class="font-bold text-slate-900 text-sm mb-1">${this.formatCategory(item.category)}</h4>
                <p class="text-xs text-slate-500 line-clamp-2 mb-3">${item.description || 'No additional notes provided'}</p>
                
                <div class="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl text-xs mb-3">
                  <div>
                    <span class="text-slate-400 block text-[10px]">Est. Weight</span>
                    <span class="font-bold text-slate-800">${item.estimatedWeightKg} kg</span>
                  </div>
                  <div>
                    <span class="text-slate-400 block text-[10px]">Asking Price</span>
                    <span class="font-bold text-slate-800">₹${item.expectedPricePerKg}/kg</span>
                  </div>
                </div>

                <div class="text-[11px] text-slate-500 flex items-center gap-1.5 mb-3">
                  <i class="fa-solid fa-location-dot text-slate-400"></i> ${item.city}, ${item.state}
                </div>
              </div>

              ${
                isAvailable
                  ? `
                <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button onclick="app.cancelListing('${item.id}')" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition">
                    Cancel Listing
                  </button>
                </div>
              `
                  : ''
              }
            </div>
          `;
        })
        .join('');
    } catch (err) {
      container.innerHTML = `<div class="col-span-full py-8 text-center text-rose-500">Error loading listings: ${err.message}</div>`;
    }
  }

  async loadCollectorTransactions() {
    const tbody = document.getElementById('collector-transactions-tbody');
    try {
      const txs = await window.api.getCollectorTransactions();

      if (!txs || txs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">No handover transactions recorded yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = txs
        .map((tx) => {
          const statusClass = `badge-${tx.status.toLowerCase()}`;
          const canConfirm = !tx.collectorConfirmedAt && tx.status !== 'CANCELLED' && tx.status !== 'DISPUTED';
          const hasManifest = tx.manifest?.id;

          return `
            <tr class="hover:bg-slate-50/80 transition">
              <td class="py-3 px-4 font-mono text-xs font-bold text-slate-700">${tx.id.substring(0, 8)}...</td>
              <td class="py-3 px-4 font-medium text-slate-900">${tx.recycler?.organizationName || tx.recycler?.fullName}</td>
              <td class="py-3 px-4 text-xs">${this.formatCategory(tx.listing?.category)}</td>
              <td class="py-3 px-4 font-bold text-slate-800">${tx.actualWeightKg || tx.listing?.estimatedWeightKg} kg</td>
              <td class="py-3 px-4 font-bold text-teal-800">₹${tx.totalAmount || '—'}</td>
              <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${statusClass}">${tx.status}</span>
              </td>
              <td class="py-3 px-4 text-right space-x-2">
                ${
                  canConfirm
                    ? `
                  <button onclick="app.collectorConfirm('${tx.id}')" class="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition">
                    <i class="fa-solid fa-check-double mr-1"></i> Confirm Handover
                  </button>
                `
                    : ''
                }
                ${
                  hasManifest
                    ? `
                  <button onclick="app.downloadManifestPdf('${tx.manifest.id}')" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition" title="Download PDF Manifest">
                    <i class="fa-solid fa-file-pdf text-rose-600"></i> PDF
                  </button>
                  <button onclick="app.showQrModal('${tx.manifest.id}', '${tx.manifest.manifestNumber}', '${tx.manifest.publicToken}')" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition" title="View QR Code">
                    <i class="fa-solid fa-qrcode text-brand-700"></i> QR
                  </button>
                `
                    : ''
                }
              </td>
            </tr>
          `;
        })
        .join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-rose-500">${err.message}</td></tr>`;
    }
  }

  switchCollectorSubTab(tab) {
    const isListings = tab === 'listings';
    document.getElementById('collector-subview-listings').classList.toggle('hidden', !isListings);
    document.getElementById('collector-subview-transactions').classList.toggle('hidden', isListings);

    document.getElementById('collector-tab-listings-btn').className = isListings
      ? 'pb-3 border-b-2 border-brand-700 text-brand-700 font-bold text-sm flex items-center gap-2'
      : 'pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-bold text-sm flex items-center gap-2';

    document.getElementById('collector-tab-transactions-btn').className = !isListings
      ? 'pb-3 border-b-2 border-brand-700 text-brand-700 font-bold text-sm flex items-center gap-2'
      : 'pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-bold text-sm flex items-center gap-2';
  }

  openCreateListingModal() {
    this.openModal('modal-create-listing');
  }

  async handleCreateListingSubmit(event) {
    event.preventDefault();
    const payload = {
      category: document.getElementById('listing-category').value,
      estimatedWeightKg: parseFloat(document.getElementById('listing-weight').value),
      expectedPricePerKg: parseFloat(document.getElementById('listing-price').value),
      city: document.getElementById('listing-city').value,
      state: document.getElementById('listing-state').value,
      pickupAddress: document.getElementById('listing-address').value,
      description: document.getElementById('listing-desc').value,
    };

    try {
      await window.api.createListing(payload);
      this.closeModal('modal-create-listing');
      this.toast('Waste listing created and published to marketplace!', 'success');
      document.getElementById('form-create-listing').reset();
      this.loadCollectorData();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  async cancelListing(id) {
    if (!confirm('Are you sure you want to cancel this listing?')) return;
    try {
      await window.api.cancelListing(id);
      this.toast('Listing cancelled successfully', 'info');
      this.loadCollectorListings();
      this.loadCollectorKPIs();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  async collectorConfirm(txId) {
    if (!confirm('Confirm that this electronic waste was physically handed over to the authorized recycler?')) return;
    try {
      const res = await window.api.confirmCollector(txId);
      this.toast('Handover confirmed by collector!', 'success');
      this.loadCollectorData();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  // =========================================================================
  // 3. RECYCLER MODULE
  // =========================================================================

  async loadRecyclerData() {
    await Promise.all([
      this.loadRecyclerProfile(),
      this.loadRecyclerKPIs(),
      this.loadMarketplace(),
      this.loadRecyclerHandovers(),
    ]);
  }

  async loadRecyclerProfile() {
    try {
      const profile = await window.api.getRecyclerProfile();
      const badge = document.getElementById('recycler-verification-badge');
      badge.textContent = profile.registrationStatus;
      badge.className = `px-2.5 py-0.5 rounded-full text-xs font-bold badge-${profile.registrationStatus.toLowerCase()}`;

      document.getElementById('recycler-profile-card').innerHTML = `
        <h4 class="font-bold text-slate-900 text-lg mb-2">${profile.companyName}</h4>
        <div class="grid grid-cols-2 gap-3 text-xs mb-4">
          <div>
            <span class="text-slate-400 block">Registration / Permit No:</span>
            <span class="font-mono font-bold text-slate-800">${profile.registrationNumber}</span>
          </div>
          <div>
            <span class="text-slate-400 block">Verification Status:</span>
            <span class="font-bold ${profile.registrationStatus === 'APPROVED' ? 'text-emerald-700' : 'text-amber-700'}">${profile.registrationStatus}</span>
          </div>
        </div>
        <p class="text-[11px] text-slate-500 italic">Recycler verification is an internal Project Sanchay administrative authorization permitting participation in verified custody transfers.</p>
      `;
    } catch (err) {
      console.error(err);
    }
  }

  async loadRecyclerKPIs() {
    try {
      const data = await window.api.getRecyclerDashboard();
      const overview = data.overview;

      document.getElementById('recycler-kpis').innerHTML = `
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Verified Handovers</p>
          <p class="text-2xl font-bold text-emerald-700">${overview.verifiedHandoversCount}</p>
          <span class="inline-block mt-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Completed Transfers</span>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Total Weight Received</p>
          <p class="text-2xl font-bold text-teal-800">${overview.totalWeightReceivedKg} <span class="text-xs font-normal text-slate-500">kg</span></p>
          <span class="inline-block mt-2 text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">Calibrated Inflow</span>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Active Handovers</p>
          <p class="text-2xl font-bold text-amber-600">${overview.pendingHandover + overview.partiallyConfirmed}</p>
          <span class="inline-block mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Pending Verification</span>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Total Procurement Value</p>
          <p class="text-2xl font-bold text-slate-900">₹${overview.totalPurchaseValue}</p>
          <span class="inline-block mt-2 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">Settled Bilaterally</span>
        </div>
      `;
    } catch (err) {
      console.error(err);
    }
  }

  async loadMarketplace() {
    const container = document.getElementById('marketplace-listings-container');
    container.innerHTML = '<div class="col-span-full py-8 text-center text-slate-400">Loading marketplace listings...</div>';

    const filters = {
      category: document.getElementById('market-filter-category').value,
      city: document.getElementById('market-filter-city').value,
      minWeight: document.getElementById('market-filter-minweight').value,
      maxWeight: document.getElementById('market-filter-maxweight').value,
    };

    try {
      const res = await window.api.getMarketplaceListings(filters);
      const listings = res.items || [];

      if (listings.length === 0) {
        container.innerHTML = `
          <div class="col-span-full py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <i class="fa-solid fa-store-slash text-3xl text-slate-300 mb-3"></i>
            <h4 class="font-bold text-slate-700">No Listings Match Current Filters</h4>
            <p class="text-xs text-slate-500">Try adjusting your category, city, or weight range filter settings.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = listings
        .map((item) => {
          return `
            <div class="bg-white rounded-2xl border border-slate-200 p-5 hover-card-lift flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between gap-2 mb-2">
                  <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold badge-available">AVAILABLE</span>
                  <span class="text-xs text-slate-400 font-medium">${new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                <h4 class="font-bold text-slate-900 text-sm mb-1">${this.formatCategory(item.category)}</h4>
                <p class="text-xs text-slate-500 line-clamp-2 mb-3">${item.description || 'Segregated electronics scrap batch'}</p>

                <div class="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl text-xs mb-3">
                  <div>
                    <span class="text-slate-400 block text-[10px]">Estimated Weight</span>
                    <span class="font-bold text-teal-800 text-sm">${item.estimatedWeightKg} kg</span>
                  </div>
                  <div>
                    <span class="text-slate-400 block text-[10px]">Asking Price</span>
                    <span class="font-bold text-slate-800 text-sm">₹${item.expectedPricePerKg}/kg</span>
                  </div>
                </div>

                <div class="text-[11px] text-slate-600 mb-1 flex items-center gap-1.5">
                  <i class="fa-solid fa-user text-slate-400"></i> ${item.collector?.fullName || 'Collector'} (${item.collector?.organizationName || 'Scrap Aggregator'})
                </div>
                <div class="text-[11px] text-slate-500 flex items-center gap-1.5 mb-4">
                  <i class="fa-solid fa-location-dot text-slate-400"></i> ${item.city}, ${item.state}
                </div>
              </div>

              <button onclick="app.openAcceptModal('${item.id}', '${item.category}', ${item.estimatedWeightKg}, ${item.expectedPricePerKg}, '${item.city}')" class="w-full py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-md shadow-teal-700/10 flex items-center justify-center gap-1.5 transition">
                <i class="fa-solid fa-check"></i> Accept & Reserve Batch
              </button>
            </div>
          `;
        })
        .join('');
    } catch (err) {
      container.innerHTML = `<div class="col-span-full py-8 text-center text-rose-500">${err.message}</div>`;
    }
  }

  loadMarketplaceDebounced() {
    clearTimeout(this._marketDebounce);
    this._marketDebounce = setTimeout(() => this.loadMarketplace(), 350);
  }

  resetMarketplaceFilters() {
    document.getElementById('market-filter-category').value = '';
    document.getElementById('market-filter-city').value = '';
    document.getElementById('market-filter-minweight').value = '';
    document.getElementById('market-filter-maxweight').value = '';
    this.loadMarketplace();
  }

  openAcceptModal(listingId, category, weight, price, city) {
    document.getElementById('accept-listing-id').value = listingId;
    document.getElementById('accept-agreed-price').value = price;
    document.getElementById('accept-listing-summary').innerHTML = `
      <div class="font-bold text-slate-800">${this.formatCategory(category)}</div>
      <div class="flex justify-between text-slate-600">
        <span>Batch Weight: <strong>${weight} kg</strong></span>
        <span>Location: <strong>${city}</strong></span>
      </div>
    `;
    this.openModal('modal-accept-listing');
  }

  async handleAcceptListingSubmit(event) {
    event.preventDefault();
    const listingId = document.getElementById('accept-listing-id').value;
    const agreedPrice = parseFloat(document.getElementById('accept-agreed-price').value);

    try {
      const res = await window.api.acceptListing(listingId, agreedPrice);
      this.closeModal('modal-accept-listing');
      this.toast('Listing accepted and reserved! Proceed with physical handover.', 'success');
      this.loadRecyclerData();
      this.switchRecyclerSubTab('handovers');
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  async loadRecyclerHandovers() {
    const tbody = document.getElementById('recycler-handovers-tbody');
    try {
      const txs = await window.api.getRecyclerTransactions();

      if (!txs || txs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400">No active or completed handovers. Browse the marketplace to accept batches.</td></tr>`;
        return;
      }

      tbody.innerHTML = txs
        .map((tx) => {
          const statusClass = `badge-${tx.status.toLowerCase()}`;
          const isVerified = tx.status === 'HANDOVER_VERIFIED';
          const canConfirm = !tx.recyclerConfirmedAt && tx.status !== 'CANCELLED' && tx.status !== 'DISPUTED';
          const hasManifest = tx.manifest?.id;

          return `
            <tr class="hover:bg-slate-50/80 transition">
              <td class="py-3 px-4 font-mono text-xs font-bold text-slate-700">${tx.id.substring(0, 8)}...</td>
              <td class="py-3 px-4 font-medium text-slate-900">${tx.collector?.organizationName || tx.collector?.fullName}</td>
              <td class="py-3 px-4 text-xs">${this.formatCategory(tx.listing?.category)}</td>
              <td class="py-3 px-4 font-bold text-slate-800">${tx.actualWeightKg || tx.listing?.estimatedWeightKg} kg</td>
              <td class="py-3 px-4 font-bold text-teal-800">₹${tx.totalAmount || '—'}</td>
              <td class="py-3 px-4 text-xs">
                ${
                  tx.evidenceUrls?.length > 0
                    ? `<span class="text-emerald-700 font-semibold"><i class="fa-solid fa-paperclip"></i> ${tx.evidenceUrls.length} file(s)</span>`
                    : '<span class="text-slate-400 italic">None</span>'
                }
              </td>
              <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${statusClass}">${tx.status}</span>
              </td>
              <td class="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                ${
                  !isVerified
                    ? `
                  <button onclick="app.openRecordWeightModal('${tx.id}', ${tx.actualWeightKg || tx.listing?.estimatedWeightKg})" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition" title="Record Calibrated Weight">
                    <i class="fa-solid fa-scale-balanced mr-1"></i> Weight
                  </button>
                  <button onclick="app.openEvidenceModal('${tx.id}')" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition" title="Attach Photos/Slips">
                    <i class="fa-solid fa-camera mr-1"></i> Evidence
                  </button>
                `
                    : ''
                }
                ${
                  canConfirm
                    ? `
                  <button onclick="app.recyclerConfirm('${tx.id}')" class="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 transition">
                    <i class="fa-solid fa-check mr-1"></i> Confirm Receipt
                  </button>
                `
                    : ''
                }
                ${
                  hasManifest
                    ? `
                  <button onclick="app.downloadManifestPdf('${tx.manifest.id}')" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition" title="Download PDF Manifest">
                    <i class="fa-solid fa-file-pdf text-rose-600"></i> PDF
                  </button>
                  <button onclick="app.showQrModal('${tx.manifest.id}', '${tx.manifest.manifestNumber}', '${tx.manifest.publicToken}')" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition" title="View Verification QR">
                    <i class="fa-solid fa-qrcode text-brand-700"></i> QR
                  </button>
                `
                    : ''
                }
              </td>
            </tr>
          `;
        })
        .join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-rose-500">${err.message}</td></tr>`;
    }
  }

  switchRecyclerSubTab(tab) {
    document.getElementById('recycler-subview-marketplace').classList.toggle('hidden', tab !== 'marketplace');
    document.getElementById('recycler-subview-handovers').classList.toggle('hidden', tab !== 'handovers');
    document.getElementById('recycler-subview-profile').classList.toggle('hidden', tab !== 'profile');

    ['marketplace', 'handovers', 'profile'].forEach((t) => {
      const btn = document.getElementById(`recycler-tab-${t}-btn`);
      if (btn) {
        btn.className =
          t === tab
            ? 'pb-3 border-b-2 border-brand-700 text-brand-700 font-bold text-sm flex items-center gap-2'
            : 'pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-bold text-sm flex items-center gap-2';
      }
    });
  }

  openRecordWeightModal(txId, currentWeight) {
    document.getElementById('record-weight-tx-id').value = txId;
    document.getElementById('record-actual-weight').value = currentWeight || '';
    this.openModal('modal-record-weight');
  }

  async handleRecordWeightSubmit(event) {
    event.preventDefault();
    const txId = document.getElementById('record-weight-tx-id').value;
    const weight = parseFloat(document.getElementById('record-actual-weight').value);

    try {
      await window.api.recordReceivedWeight(txId, weight);
      this.closeModal('modal-record-weight');
      this.toast(`Recorded actual weight: ${weight} kg`, 'success');
      this.loadRecyclerData();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  openEvidenceModal(txId) {
    document.getElementById('evidence-tx-id').value = txId;
    document.getElementById('form-evidence').reset();
    this.openModal('modal-evidence');
  }

  async handleEvidenceSubmit(event) {
    event.preventDefault();
    const txId = document.getElementById('evidence-tx-id').value;
    const fileInput = document.getElementById('evidence-file');
    const notes = document.getElementById('evidence-notes').value;

    let urls = [];
    try {
      if (fileInput.files.length > 0) {
        this.toast('Uploading evidence file...', 'info');
        const uploadRes = await window.api.uploadFile(fileInput.files[0], 'evidence');
        urls.push(uploadRes.file.relativePath);
      } else {
        urls.push('/uploads/evidence/sample-weighing-slip.jpg');
      }

      await window.api.addEvidence(txId, urls, notes);
      this.closeModal('modal-evidence');
      this.toast('Handover proof attached successfully!', 'success');
      this.loadRecyclerHandovers();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  async recyclerConfirm(txId) {
    if (!confirm('Confirm physical receipt of electronic waste at your recycling facility?')) return;
    try {
      const res = await window.api.confirmRecycler(txId);
      this.toast('Handover confirmed by recycler!', 'success');
      this.loadRecyclerData();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  // =========================================================================
  // 4. BRAND DASHBOARD & ANALYTICS MODULE
  // =========================================================================

  async loadBrandData() {
    await Promise.all([this.loadBrandDashboard(), this.loadBrandManifests()]);
  }

  async loadBrandDashboard() {
    try {
      const data = await window.api.getBrandDashboard();
      const kpis = data.kpis;

      document.getElementById('brand-kpis').innerHTML = `
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Documented Waste Diverted</p>
          <p class="text-3xl font-extrabold text-indigo-700">${kpis.totalDocumentedWeightKg} <span class="text-sm font-normal text-slate-500">kg</span></p>
          <span class="inline-block mt-2 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">Audited Handover Trail</span>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Verified Handovers</p>
          <p class="text-3xl font-extrabold text-slate-900">${kpis.verifiedHandoversCount}</p>
          <span class="inline-block mt-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Dual Confirmed</span>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Associated Recyclers</p>
          <p class="text-3xl font-extrabold text-teal-700">${kpis.associatedRecyclersCount}</p>
          <span class="inline-block mt-2 text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">Authorized Processors</span>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Digital Manifests</p>
          <p class="text-3xl font-extrabold text-slate-900">${kpis.manifestCount}</p>
          <span class="inline-block mt-2 text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">Tamper-Evident QR</span>
        </div>
      `;

      // Category breakdown visualizer
      const catContainer = document.getElementById('brand-category-distribution');
      if (data.categoryDistribution.length === 0) {
        catContainer.innerHTML = '<p class="text-xs text-slate-400 italic">No category data documented yet.</p>';
      } else {
        catContainer.innerHTML = data.categoryDistribution
          .map(
            (c) => `
          <div>
            <div class="flex justify-between text-xs mb-1 font-semibold">
              <span class="text-slate-800">${this.formatCategory(c.category)}</span>
              <span class="text-indigo-700 font-bold">${c.weightKg} kg (${c.percentage}%)</span>
            </div>
            <div class="custom-progress">
              <div class="custom-progress-bar bg-indigo-600" style="width: ${c.percentage}%"></div>
            </div>
          </div>
        `,
          )
          .join('');
      }

      // City breakdown visualizer
      const locContainer = document.getElementById('brand-location-distribution');
      if (data.cityDistribution.length === 0) {
        locContainer.innerHTML = '<p class="text-xs text-slate-400 italic">No location records available.</p>';
      } else {
        locContainer.innerHTML = data.cityDistribution
          .map(
            (loc) => `
          <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
            <div class="flex items-center gap-2">
              <i class="fa-solid fa-map-pin text-indigo-500"></i>
              <span class="font-bold text-slate-800">${loc.city}, ${loc.state}</span>
            </div>
            <div class="text-right">
              <span class="font-bold text-slate-900">${loc.weightKg} kg</span>
              <span class="text-[10px] text-slate-400 block">${loc.count} batch(es)</span>
            </div>
          </div>
        `,
          )
          .join('');
      }
    } catch (err) {
      console.error(err);
    }
  }

  async loadBrandManifests() {
    const tbody = document.getElementById('brand-manifests-tbody');
    try {
      const res = await window.api.getBrandManifests();
      const manifests = res.items || [];

      if (manifests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-slate-400">No manifests associated with this brand account yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = manifests
        .map(
          (m) => `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="py-3 px-4 font-mono text-xs font-bold text-indigo-700">${m.manifestNumber}</td>
          <td class="py-3 px-4 text-xs">${new Date(m.handoverDate).toLocaleDateString()}</td>
          <td class="py-3 px-4 text-xs font-semibold text-slate-800">${this.formatCategory(m.wasteCategory)}</td>
          <td class="py-3 px-4 font-bold text-slate-900">${m.actualWeightKg} kg</td>
          <td class="py-3 px-4 text-xs text-slate-600">${m.city}, ${m.state}</td>
          <td class="py-3 px-4 text-xs font-medium">${m.recyclerOrg || m.recyclerName}</td>
          <td class="py-3 px-4 text-right space-x-2">
            <button onclick="app.downloadManifestPdf('${m.id}')" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition" title="Download Verified PDF">
              <i class="fa-solid fa-file-pdf text-rose-600"></i> PDF
            </button>
            <button onclick="app.showQrModal('${m.id}', '${m.manifestNumber}', '${m.publicToken}')" class="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition" title="Preview QR Verification">
              <i class="fa-solid fa-qrcode text-indigo-700"></i> QR
            </button>
          </td>
        </tr>
      `,
        )
        .join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-8 text-center text-rose-500">${err.message}</td></tr>`;
    }
  }

  async exportBrandCsv() {
    try {
      this.toast('Generating verified chain-of-custody CSV...', 'info');
      const blob = await window.api.exportBrandCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sanchay-brand-sustainability-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      this.toast('CSV downloaded successfully!', 'success');
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  // =========================================================================
  // 5. ADMIN CONTROL ROOM
  // =========================================================================

  async loadAdminData() {
    await Promise.all([
      this.loadAdminKPIs(),
      this.loadAdminPendingRecyclers(),
      this.loadAdminUsers(),
      this.loadAdminListings(),
      this.loadAdminManifests(),
      this.loadAdminAuditLogs(),
    ]);
  }

  async loadAdminKPIs() {
    try {
      const data = await window.api.getAdminDashboard();
      const p = data.platformMetrics;
      const u = data.userBreakdown;

      document.getElementById('pending-recycler-count').textContent = p.pendingRecyclerApprovals;

      document.getElementById('admin-kpis').innerHTML = `
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Total Platform Users</p>
          <p class="text-2xl font-bold text-slate-900">${u.total}</p>
          <span class="text-[10px] text-slate-500 block mt-1">${u.collectors} Col / ${u.recyclers} Rec / ${u.brands} Brand</span>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Documented Waste</p>
          <p class="text-2xl font-bold text-teal-800">${p.totalDocumentedWeightKg} <span class="text-xs font-normal text-slate-500">kg</span></p>
          <span class="inline-block mt-1 text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">All Handovers</span>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Total Handover Value</p>
          <p class="text-2xl font-bold text-slate-900">₹${p.totalGrossTransactionValue}</p>
          <span class="inline-block mt-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Platform Volume</span>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Facilitation Fees</p>
          <p class="text-2xl font-bold text-indigo-700">₹${p.totalPlatformFeesCollected}</p>
          <span class="inline-block mt-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">₹2/kg Accrued</span>
        </div>
        <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <p class="text-xs font-semibold text-slate-500 mb-1">Pending Recyclers</p>
          <p class="text-2xl font-bold text-rose-600">${p.pendingRecyclerApprovals}</p>
          <span class="inline-block mt-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full">Awaiting Review</span>
        </div>
      `;
    } catch (err) {
      console.error(err);
    }
  }

  async loadAdminPendingRecyclers() {
    const container = document.getElementById('admin-pending-recyclers-container');
    try {
      const recyclers = await window.api.getPendingRecyclers();

      if (!recyclers || recyclers.length === 0) {
        container.innerHTML = `
          <div class="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <i class="fa-solid fa-check-circle text-2xl text-emerald-500 mb-2"></i>
            <p class="font-bold text-slate-700 text-sm">No Pending Recycler Verification Applications</p>
            <p class="text-xs text-slate-500">All registered recycling facilities have been reviewed.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = recyclers
        .map(
          (r) => `
        <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="font-bold text-slate-900 text-sm">${r.companyName}</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold badge-pending">PENDING</span>
            </div>
            <p class="text-xs text-slate-600">Representative: <strong>${r.user?.fullName}</strong> • ${r.user?.email} • ${r.user?.phone}</p>
            <p class="text-xs font-mono text-slate-500 mt-1">Registration #: <strong>${r.registrationNumber}</strong> (${r.user?.city}, ${r.user?.state})</p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="app.approveRecycler('${r.id}')" class="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition">
              <i class="fa-solid fa-check mr-1"></i> Approve
            </button>
            <button onclick="app.rejectRecycler('${r.id}')" class="px-3.5 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-300 transition">
              <i class="fa-solid fa-xmark mr-1"></i> Reject
            </button>
          </div>
        </div>
      `,
        )
        .join('');
    } catch (err) {
      container.innerHTML = `<div class="p-4 text-center text-rose-500">${err.message}</div>`;
    }
  }

  async approveRecycler(profileId) {
    try {
      await window.api.approveRecycler(profileId);
      this.toast('Recycler application approved!', 'success');
      this.loadAdminData();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  async rejectRecycler(profileId) {
    if (!confirm('Reject this recycler application?')) return;
    try {
      await window.api.rejectRecycler(profileId);
      this.toast('Recycler application rejected.', 'info');
      this.loadAdminData();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  async loadAdminUsers() {
    const tbody = document.getElementById('admin-users-tbody');
    try {
      const res = await window.api.getAdminUsers();
      tbody.innerHTML = (res.items || [])
        .map(
          (u) => `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="py-2.5 px-4 font-bold text-slate-900">${u.fullName}</td>
          <td class="py-2.5 px-4 text-xs font-mono">${u.email}</td>
          <td class="py-2.5 px-4">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold role-pill-${u.role.toLowerCase()}">${u.role}</span>
          </td>
          <td class="py-2.5 px-4 text-xs text-slate-600">${u.organizationName || '—'}</td>
          <td class="py-2.5 px-4 text-xs text-slate-600">${u.city}, ${u.state}</td>
          <td class="py-2.5 px-4 text-xs text-slate-400">${new Date(u.createdAt).toLocaleDateString()}</td>
        </tr>
      `,
        )
        .join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-rose-500">${err.message}</td></tr>`;
    }
  }

  async loadAdminListings() {
    const tbody = document.getElementById('admin-listings-tbody');
    try {
      const res = await window.api.getAdminListings();
      tbody.innerHTML = (res.items || [])
        .map(
          (l) => `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="py-2.5 px-4 font-mono text-xs">${l.id.substring(0, 8)}...</td>
          <td class="py-2.5 px-4 text-xs font-bold text-slate-800">${this.formatCategory(l.category)}</td>
          <td class="py-2.5 px-4 text-xs">${l.estimatedWeightKg} kg</td>
          <td class="py-2.5 px-4 text-xs font-bold">₹${l.expectedPricePerKg}/kg</td>
          <td class="py-2.5 px-4 text-xs">${l.collector?.fullName}</td>
          <td class="py-2.5 px-4 text-xs">${l.city}</td>
          <td class="py-2.5 px-4">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold badge-${l.status.toLowerCase()}">${l.status}</span>
          </td>
        </tr>
      `,
        )
        .join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-rose-500">${err.message}</td></tr>`;
    }
  }

  async loadAdminManifests() {
    const tbody = document.getElementById('admin-manifests-tbody');
    try {
      const res = await window.api.getAdminManifests();
      tbody.innerHTML = (res.items || [])
        .map(
          (m) => `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="py-2.5 px-4 font-mono text-xs font-bold text-teal-800">${m.manifestNumber}</td>
          <td class="py-2.5 px-4 text-xs">${new Date(m.handoverDate).toLocaleDateString()}</td>
          <td class="py-2.5 px-4 text-xs font-semibold">${this.formatCategory(m.wasteCategory)}</td>
          <td class="py-2.5 px-4 text-xs font-bold text-slate-900">${m.actualWeightKg} kg</td>
          <td class="py-2.5 px-4 text-xs">${m.collectorName}</td>
          <td class="py-2.5 px-4 text-xs">${m.recyclerName}</td>
          <td class="py-2.5 px-4 text-xs">
            ${
              m.brandAccess?.length > 0
                ? `<span class="text-indigo-700 font-bold">${m.brandAccess.length} Brand(s)</span>`
                : '<span class="text-slate-400 italic">None</span>'
            }
          </td>
          <td class="py-2.5 px-4 text-right">
            <button onclick="app.downloadManifestPdf('${m.id}')" class="px-2 py-1 rounded text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300">
              <i class="fa-solid fa-file-pdf text-rose-600"></i> PDF
            </button>
          </td>
        </tr>
      `,
        )
        .join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="py-4 text-center text-rose-500">${err.message}</td></tr>`;
    }
  }

  async loadAdminAuditLogs() {
    const tbody = document.getElementById('admin-audit-tbody');
    try {
      const res = await window.api.getAdminAuditLogs();
      tbody.innerHTML = (res.items || [])
        .map(
          (log) => `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="py-2 px-3 text-slate-400">${new Date(log.createdAt).toLocaleTimeString()}</td>
          <td class="py-2 px-3 font-bold text-slate-800">${log.action}</td>
          <td class="py-2 px-3 text-slate-600">${log.entityType}</td>
          <td class="py-2 px-3 text-slate-700">${log.actor?.fullName || 'System'}</td>
          <td class="py-2 px-3">
            ${
              log.newStatus
                ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 font-bold">${log.previousStatus || '—'} → ${log.newStatus}</span>`
                : '—'
            }
          </td>
          <td class="py-2 px-3 text-slate-400 text-[10px] truncate max-w-xs">${JSON.stringify(log.metadata || {})}</td>
        </tr>
      `,
        )
        .join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-rose-500">${err.message}</td></tr>`;
    }
  }

  switchAdminSubTab(tab) {
    ['recyclers', 'users', 'listings', 'manifests', 'audit'].forEach((t) => {
      document.getElementById(`admin-subview-${t}`).classList.toggle('hidden', t !== tab);
      const btn = document.getElementById(`admin-tab-${t}-btn`);
      if (btn) {
        btn.className =
          t === tab
            ? 'pb-3 border-b-2 border-brand-700 text-brand-700 font-bold text-sm flex items-center gap-2 flex-shrink-0'
            : 'pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 font-bold text-sm flex items-center gap-2 flex-shrink-0';
      }
    });
  }

  async openAssociateBrandModal() {
    try {
      const [usersRes, manifestsRes] = await Promise.all([window.api.getAdminUsers(), window.api.getAdminManifests()]);

      const brands = (usersRes.items || []).filter((u) => u.role === 'BRAND');
      const manifests = manifestsRes.items || [];

      document.getElementById('associate-brand-select').innerHTML = brands
        .map((b) => `<option value="${b.id}">${b.fullName} (${b.organizationName || b.email})</option>`)
        .join('');

      document.getElementById('associate-manifest-select').innerHTML = manifests
        .map((m) => `<option value="${m.id}">${m.manifestNumber} — ${this.formatCategory(m.wasteCategory)} (${m.actualWeightKg} kg)</option>`)
        .join('');

      this.openModal('modal-associate-brand');
    } catch (err) {
      this.toast(`Failed to prepare association modal: ${err.message}`, 'error');
    }
  }

  async handleAssociateBrandSubmit(event) {
    event.preventDefault();
    const brandId = document.getElementById('associate-brand-select').value;
    const manifestId = document.getElementById('associate-manifest-select').value;

    try {
      await window.api.associateBrandManifest(brandId, manifestId);
      this.closeModal('modal-associate-brand');
      this.toast('Manifest successfully associated with Brand account!', 'success');
      this.loadAdminManifests();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  // =========================================================================
  // 6. PUBLIC QR VERIFICATION & MODALS
  // =========================================================================

  showPublicVerifyModal() {
    this.navigate('verify');
  }

  async executePublicVerify(tokenParam) {
    const token = tokenParam || document.getElementById('verify-token-input').value.trim();
    const container = document.getElementById('verify-result-container');

    if (!token) {
      this.toast('Please enter a valid verification token', 'warning');
      return;
    }

    container.innerHTML = '<div class="py-12 text-center text-slate-400">Verifying manifest on immutable registry...</div>';

    try {
      const res = await window.api.verifyPublicToken(token);

      container.innerHTML = `
        <div class="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl">
          <div class="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <i class="fa-solid fa-shield-check mr-1"></i> ${res.verificationStatus}
              </span>
              <h2 class="text-2xl font-bold text-slate-900 mt-2 font-mono">${res.manifestNumber}</h2>
            </div>
            <div class="text-right text-xs text-slate-400">
              Verified Handover Date<br>
              <strong class="text-slate-800 text-sm">${new Date(res.handoverDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl mb-6">
            <div>
              <span class="text-slate-400 text-xs block">Category</span>
              <span class="font-bold text-slate-900 text-sm">${this.formatCategory(res.wasteCategory)}</span>
            </div>
            <div>
              <span class="text-slate-400 text-xs block">Verified Weight</span>
              <span class="font-bold text-emerald-800 text-base">${res.actualWeightKg} kg</span>
            </div>
            <div>
              <span class="text-slate-400 text-xs block">Source Location</span>
              <span class="font-bold text-slate-900 text-sm">${res.sourceCity}, ${res.sourceState}</span>
            </div>
            <div>
              <span class="text-slate-400 text-xs block">Processor Facility</span>
              <span class="font-bold text-slate-900 text-sm">${res.recyclerFacility}</span>
            </div>
          </div>

          <!-- Mandatory Compliance Disclaimer Box -->
          <div class="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-950 mb-6">
            <div class="font-bold text-rose-800 mb-1 flex items-center gap-1.5">
              <i class="fa-solid fa-triangle-exclamation"></i> Mandatory Compliance & Regulatory Notice
            </div>
            <p class="leading-relaxed">${res.complianceNotice}</p>
          </div>

          <div class="text-[11px] text-slate-400 text-center">
            Cryptographically sealed and registered on the Project Sanchay Digital Custody Platform. Private individual identities, contact numbers, and commercial rates are securely masked.
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="bg-white rounded-3xl border border-rose-200 p-8 text-center shadow-lg">
          <div class="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xl mx-auto mb-3">
            <i class="fa-solid fa-circle-exclamation"></i>
          </div>
          <h3 class="text-lg font-bold text-slate-900 mb-1">Manifest Verification Failed</h3>
          <p class="text-xs text-slate-500 mb-4">${err.message}</p>
          <p class="text-xs text-slate-400">Please verify that the scanned token corresponds to an active Project Sanchay handover record.</p>
        </div>
      `;
    }
  }

  showQrModal(manifestId, manifestNumber, publicToken) {
    document.getElementById('qr-modal-manifest-num').textContent = manifestNumber;
    document.getElementById('qr-modal-image').src = window.api.getManifestQrUrl(manifestId);

    const verifyBtn = document.getElementById('qr-modal-verify-btn');
    verifyBtn.onclick = () => {
      this.closeModal('modal-qr');
      document.getElementById('verify-token-input').value = publicToken;
      this.navigate('verify');
      this.executePublicVerify(publicToken);
    };

    this.openModal('modal-qr');
  }

  async downloadManifestPdf(manifestId) {
    try {
      this.toast('Downloading PDF Manifest...', 'info');
      const blob = await window.api.downloadManifestPdf(manifestId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sanchay-Manifest-${manifestId.substring(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      this.toast('PDF Manifest downloaded!', 'success');
    } catch (err) {
      this.toast(err.message, 'error');
    }
  }

  formatCategory(cat) {
    if (!cat) return '—';
    return cat
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

// Global application bootstrap
window.app = new App();

