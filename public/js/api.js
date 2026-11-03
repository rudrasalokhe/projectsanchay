/**
 * Sanchay REST API Client
 * Manages JWT tokens, automatic refresh, error extraction, and REST endpoint calls.
 */

const API_BASE = '/api';

class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem('sanchay_access_token');
    this.refreshToken = localStorage.getItem('sanchay_refresh_token');
    this.currentUser = JSON.parse(localStorage.getItem('sanchay_user') || 'null');
  }

  setSession(tokens, user) {
    if (tokens) {
      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
      localStorage.setItem('sanchay_access_token', tokens.accessToken);
      localStorage.setItem('sanchay_refresh_token', tokens.refreshToken);
    }
    if (user) {
      this.currentUser = user;
      localStorage.setItem('sanchay_user', JSON.stringify(user));
    }
  }

  clearSession() {
    this.accessToken = null;
    this.refreshToken = null;
    this.currentUser = null;
    localStorage.removeItem('sanchay_access_token');
    localStorage.removeItem('sanchay_refresh_token');
    localStorage.removeItem('sanchay_user');
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  getUserRole() {
    return this.currentUser?.role || null;
  }

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = options.headers || {};

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    try {
      let response = await fetch(url, { ...options, headers });

      // Handle 401 Unauthorized with token refresh rotation
      if (response.status === 401 && this.refreshToken && !options._isRetry) {
        const refreshSuccess = await this.rotateRefreshToken();
        if (refreshSuccess) {
          options._isRetry = true;
          headers['Authorization'] = `Bearer ${this.accessToken}`;
          response = await fetch(url, { ...options, headers });
        } else {
          this.clearSession();
          window.dispatchEvent(new CustomEvent('auth:expired'));
          throw new Error('Your session has expired. Please log in again.');
        }
      }

      // Check for file/blob response (e.g. CSV or PDF download)
      if (options.asBlob) {
        if (!response.ok) {
          throw new Error(`Download failed with status ${response.status}`);
        }
        return await response.blob();
      }

      const json = await response.json();

      if (!response.ok) {
        const errMessage = json.message || json.errors?.[0] || 'Request failed';
        throw new Error(Array.isArray(errMessage) ? errMessage.join(', ') : errMessage);
      }

      return json.data !== undefined ? json.data : json;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  async rotateRefreshToken() {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) return false;

      const res = await response.json();
      const tokens = res.data;
      this.accessToken = tokens.accessToken;
      this.refreshToken = tokens.refreshToken;
      localStorage.setItem('sanchay_access_token', tokens.accessToken);
      localStorage.setItem('sanchay_refresh_token', tokens.refreshToken);
      return true;
    } catch (err) {
      return false;
    }
  }

  // --- AUTH ENDPOINTS ---
  async register(data) {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.setSession(res.tokens, res.user);
    return res;
  }

  async login(email, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setSession(res.tokens, res.user);
    return res;
  }

  async logout() {
    try {
      if (this.accessToken) {
        await this.request('/auth/logout', { method: 'POST' });
      }
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      this.clearSession();
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  }

  async getMe() {
    const user = await this.request('/auth/me');
    this.currentUser = user;
    localStorage.setItem('sanchay_user', JSON.stringify(user));
    return user;
  }

  // --- LISTINGS ENDPOINTS ---
  async createListing(listingData) {
    return this.request('/listings', {
      method: 'POST',
      body: JSON.stringify(listingData),
    });
  }

  async getMyListings(query = {}) {
    const params = new URLSearchParams(query).toString();
    return this.request(`/listings/my?${params}`);
  }

  async getListing(id) {
    return this.request(`/listings/${id}`);
  }

  async updateListing(id, updateData) {
    return this.request(`/listings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    });
  }

  async cancelListing(id) {
    return this.request(`/listings/${id}`, {
      method: 'DELETE',
    });
  }

  // --- MARKETPLACE ENDPOINTS ---
  async getMarketplaceListings(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, v);
    });
    return this.request(`/marketplace/listings?${params.toString()}`);
  }

  async getMarketplaceListingDetails(id) {
    return this.request(`/marketplace/listings/${id}`);
  }

  // --- TRANSACTIONS & HANDOVER ENDPOINTS ---
  async getTransactions(query = {}) {
    const params = new URLSearchParams(query).toString();
    return this.request(`/transactions?${params}`);
  }

  async getTransaction(id) {
    return this.request(`/transactions/${id}`);
  }

  async acceptListing(listingId, agreedPricePerKg) {
    const body = agreedPricePerKg ? JSON.stringify({ agreedPricePerKg }) : '{}';
    return this.request(`/transactions/accept/${listingId}`, {
      method: 'POST',
      body,
    });
  }

  async recordReceivedWeight(transactionId, actualWeightKg) {
    return this.request(`/transactions/${transactionId}/received-weight`, {
      method: 'PATCH',
      body: JSON.stringify({ actualWeightKg }),
    });
  }

  async addEvidence(transactionId, evidenceUrls, evidenceNotes) {
    return this.request(`/transactions/${transactionId}/evidence`, {
      method: 'POST',
      body: JSON.stringify({ evidenceUrls, evidenceNotes }),
    });
  }

  async confirmCollector(transactionId) {
    return this.request(`/transactions/${transactionId}/collector-confirm`, {
      method: 'POST',
    });
  }

  async confirmRecycler(transactionId) {
    return this.request(`/transactions/${transactionId}/recycler-confirm`, {
      method: 'POST',
    });
  }

  async cancelTransaction(transactionId, reason) {
    return this.request(`/transactions/${transactionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async disputeTransaction(transactionId, reason) {
    return this.request(`/transactions/${transactionId}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // --- MANIFESTS & QR ENDPOINTS ---
  async getManifests(query = {}) {
    const params = new URLSearchParams(query).toString();
    return this.request(`/manifests?${params}`);
  }

  async getManifest(id) {
    return this.request(`/manifests/${id}`);
  }

  async downloadManifestPdf(id) {
    const blob = await this.request(`/manifests/${id}/pdf`, { asBlob: true });
    return blob;
  }

  getManifestQrUrl(id) {
    return `${API_BASE}/manifests/${id}/qr`;
  }

  async verifyPublicToken(token) {
    return this.request(`/verify/${token}`);
  }

  // --- COLLECTOR DASHBOARD ---
  async getCollectorDashboard() {
    return this.request('/collectors/dashboard');
  }

  async getCollectorTransactions() {
    return this.request('/collectors/transactions');
  }

  // --- RECYCLER DASHBOARD ---
  async getRecyclerDashboard() {
    return this.request('/recyclers/dashboard');
  }

  async getRecyclerProfile() {
    return this.request('/recyclers/profile');
  }

  async getRecyclerTransactions() {
    return this.request('/recyclers/transactions');
  }

  // --- BRAND DASHBOARD & ANALYTICS ---
  async getBrandDashboard(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/brands/dashboard?${params}`);
  }

  async getBrandCategories(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/brands/analytics/categories?${params}`);
  }

  async getBrandMonthly(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/brands/analytics/monthly?${params}`);
  }

  async getBrandLocations(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/brands/analytics/locations?${params}`);
  }

  async getBrandManifests(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request(`/brands/manifests?${params}`);
  }

  async exportBrandCsv(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const blob = await this.request(`/brands/export/csv?${params}`, { asBlob: true });
    return blob;
  }

  // --- ADMIN ENDPOINTS ---
  async getAdminDashboard() {
    return this.request('/admin/dashboard');
  }

  async getAdminUsers(query = {}) {
    const params = new URLSearchParams(query).toString();
    return this.request(`/admin/users?${params}`);
  }

  async getPendingRecyclers() {
    return this.request('/admin/recyclers/pending');
  }

  async approveRecycler(profileId) {
    return this.request(`/admin/recyclers/${profileId}/approve`, {
      method: 'PATCH',
    });
  }

  async rejectRecycler(profileId) {
    return this.request(`/admin/recyclers/${profileId}/reject`, {
      method: 'PATCH',
    });
  }

  async getAdminListings(query = {}) {
    const params = new URLSearchParams(query).toString();
    return this.request(`/admin/listings?${params}`);
  }

  async getAdminTransactions(query = {}) {
    const params = new URLSearchParams(query).toString();
    return this.request(`/admin/transactions?${params}`);
  }

  async getAdminManifests(query = {}) {
    const params = new URLSearchParams(query).toString();
    return this.request(`/admin/manifests?${params}`);
  }

  async associateBrandManifest(brandId, manifestId) {
    return this.request(`/admin/brands/${brandId}/manifests/${manifestId}`, {
      method: 'POST',
    });
  }

  async getAdminAuditLogs(query = {}) {
    const params = new URLSearchParams(query).toString();
    return this.request(`/admin/audit-logs?${params}`);
  }

  // --- FILE UPLOADS ---
  async uploadFile(file, type = 'photos') {
    const formData = new FormData();
    formData.append('file', file);
    return this.request(`/uploads/${type}`, {
      method: 'POST',
      body: formData,
    });
  }
}

// Global instance
window.api = new ApiClient();

