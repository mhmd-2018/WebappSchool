// ==================== API CONFIGURATION ====================
const API_BASE = '/api';

// Escapes text pulled from the database (course fields, reviews, contact
// messages, log entries, ...) before it is interpolated into an innerHTML
// template. Contact/feedback content in particular comes from unauthenticated,
// unsanitized endpoints, so this is required to prevent stored XSS.
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// First character of a name for an avatar badge, escaped and falling back
// when the name is missing.
function avatarInitial(name, fallback = '?') {
    return escapeHtml((name || fallback).charAt(0));
}

async function apiRequest(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('noqToken');
    if (token) headers['Authorization'] = `Token ${token}`;

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, config);
        if (res.status === 401) {
            localStorage.removeItem('noqToken');
            localStorage.removeItem('noqUser');
            return null;
        }
        if (res.status === 204) return {};
        const data = await res.json();
        if (!res.ok) throw { status: res.status, data };
        return data;
    } catch (err) {
        console.error('API Error:', err);
        throw err;
    }
}

// ==================== STATE & UTILITIES ====================
let currentUser = JSON.parse(localStorage.getItem('noqUser')) || null;
let selectedRating = 0;
let authMode = 'signin';
let coursesData = [];

function getPageName() {
    const path = window.location.pathname;
    const page = path.split('/').pop();
    return page || 'base.html';
}

function updateNavAuth() {
    const navAuthElements = document.querySelectorAll('.nav-auth');
    navAuthElements.forEach(el => {
        if (currentUser) {
            el.innerHTML = `
                <span style="font-weight:600;font-size:0.85rem;color:var(--text-secondary);">${escapeHtml(currentUser.name.split(' ')[0])}</span>
                <button class="btn btn-outline btn-sm" onclick="handleLogout()">Logout</button>
            `;
        } else {
            el.innerHTML = `
                <button class="btn btn-outline btn-sm" onclick="window.location.href='signup.html'">Sign In</button>
                <button class="btn btn-primary btn-sm" onclick="window.location.href='signup.html'">Sign Up</button>
            `;
        }
    });
    updateAdminNavLink();
}

// Only staff accounts should see the Admin link, and only pages that don't
// already ship it in their static nav (admin_dashboard.html itself) get it injected.
function updateAdminNavLink() {
    document.querySelectorAll('.nav-links').forEach(navLinks => {
        const existing = navLinks.querySelector('a[href="admin_dashboard.html"]');
        if (currentUser && currentUser.is_staff) {
            if (!existing) {
                const li = document.createElement('li');
                li.innerHTML = '<a href="admin_dashboard.html">Admin</a>';
                navLinks.appendChild(li);
            }
        } else if (existing && !existing.classList.contains('active')) {
            existing.closest('li').remove();
        }
    });
}

function toggleMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    const hamburger = document.getElementById('hamburger');
    navLinks.classList.toggle('open');
    hamburger.classList.toggle('active');
}

// ==================== AUTH FUNCTIONS ====================
function switchAuthTab(mode) {
    authMode = mode;
    document.getElementById('signinForm').style.display = mode === 'signin' ? 'block' : 'none';
    document.getElementById('signupForm').style.display = mode === 'signup' ? 'block' : 'none';
    document.getElementById('tabSignIn').classList.toggle('active', mode === 'signin');
    document.getElementById('tabSignUp').classList.toggle('active', mode === 'signup');
    document.getElementById('authTitle').textContent = mode === 'signin' ? 'Welcome Back' : 'Create Account';
    document.getElementById('authSubtitle').textContent = mode === 'signin' ? 'Sign in to continue your learning journey' : 'Join No. Q and start learning today';
    document.getElementById('signinError').classList.remove('show');
    document.getElementById('signupError').classList.remove('show');
}

async function handleSignIn() {
    const phone = document.getElementById('signinPhone').value.trim();
    const password = document.getElementById('signinPassword').value;
    const errorEl = document.getElementById('signinError');

    try {
        const data = await apiRequest('/auth/login/', 'POST', { phone, password });
        if (data && data.token) {
            localStorage.setItem('noqToken', data.token);
            localStorage.setItem('noqUser', JSON.stringify(data.user));
            currentUser = data.user;
            errorEl.classList.remove('show');
            updateNavAuth();
            window.location.href = data.user.is_staff ? 'admin_dashboard.html' : 'User_dashboard.html';
        } else {
            errorEl.textContent = 'Invalid phone number or password.';
            errorEl.classList.add('show');
        }
    } catch (err) {
        errorEl.textContent = (err.data && err.data.error) || 'Invalid phone number or password.';
        errorEl.classList.add('show');
    }
}

async function handleSignUp() {
    const name = document.getElementById('signupName').value.trim();
    const phone = document.getElementById('signupPhone').value.trim();
    const password = document.getElementById('signupPassword').value;
    const errorEl = document.getElementById('signupError');

    if (!name || !phone || !password || password.length < 6) {
        errorEl.textContent = 'Please fill all fields. Password must be at least 6 characters.';
        errorEl.classList.add('show');
        return;
    }

    try {
        const data = await apiRequest('/auth/register/', 'POST', { name, phone, password });
        if (data && data.token) {
            localStorage.setItem('noqToken', data.token);
            localStorage.setItem('noqUser', JSON.stringify(data.user));
            currentUser = data.user;
            errorEl.classList.remove('show');
            updateNavAuth();
            window.location.href = data.user.is_staff ? 'admin_dashboard.html' : 'User_dashboard.html';
        } else {
            errorEl.textContent = 'Registration failed.';
            errorEl.classList.add('show');
        }
    } catch (err) {
        errorEl.textContent = (err.data && err.data.error) || 'Registration failed.';
        errorEl.classList.add('show');
    }
}

function handleLogout() {
    apiRequest('/auth/logout/', 'POST').catch(() => {});
    currentUser = null;
    localStorage.removeItem('noqToken');
    localStorage.removeItem('noqUser');
    updateNavAuth();
    window.location.href = 'base.html';
}

// ==================== COURSES (API) ====================
async function fetchCourses() {
    try {
        const data = await apiRequest('/courses/');
        coursesData = data.results || data;
        return coursesData;
    } catch (err) {
        console.error('Failed to fetch courses:', err);
        coursesData = [];
        return coursesData;
    }
}

async function fetchCourseDetail(id) {
    try {
        return await apiRequest(`/courses/${id}/`);
    } catch (err) {
        console.error('Failed to fetch course:', err);
        return null;
    }
}

// ==================== SEARCH & FILTER ====================
function showSuggestions(query) {
    const container = document.getElementById('searchSuggestions');
    if (!container) return;
    if (!query || query.trim().length < 1) {
        container.classList.remove('show');
        return;
    }
    const results = coursesData.filter(c =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.category.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
    if (results.length === 0) {
        container.classList.remove('show');
        return;
    }
    container.innerHTML = results.map(c => `
        <div class="suggestion" onclick="window.location.href='course.html?id=${c.id}'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <div>
                <div class="suggestion-name">${escapeHtml(c.name)}</div>
                <div class="suggestion-cat">${escapeHtml(c.category)} | ${c.rating}</div>
            </div>
        </div>
    `).join('');
    container.classList.add('show');
}

function hideSuggestions() {
    const container = document.getElementById('searchSuggestions');
    if (container) container.classList.remove('show');
}

function searchFromHero() {
    const query = document.getElementById('heroSearchInput').value.trim();
    if (query) {
        window.location.href = `course_list.html?search=${encodeURIComponent(query)}`;
    }
}

function filterCourses() {
    const query = document.getElementById('coursesSearchInput').value.trim().toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    const list = document.getElementById('coursesList');
    const noResults = document.getElementById('noResults');
    const filtered = coursesData.filter(c => {
        const matchesQuery = !query || c.name.toLowerCase().includes(query) || (c.summary && c.summary.toLowerCase().includes(query)) || (c.instructor && c.instructor.toLowerCase().includes(query));
        const matchesCategory = category === 'all' || c.category === category;
        return matchesQuery && matchesCategory;
    });
    if (filtered.length === 0) {
        list.innerHTML = '';
        noResults.style.display = 'block';
        return;
    }
    noResults.style.display = 'none';
    list.innerHTML = filtered.map(c => `
        <div class="course-row-card" onclick="window.location.href='course.html?id=${c.id}'">
            <div class="course-icon" style="background:${escapeHtml(c.color) || '#4361ee'};">${escapeHtml(c.icon) || 'Q'}</div>
            <div class="course-info">
                <div class="course-top-row">
                    <h3 class="course-name">${escapeHtml(c.name)}</h3>
                    <span class="course-rating">${c.rating} (${c.rating_count ? c.rating_count.toLocaleString() : '0'})</span>
                    <span class="course-category-badge">${escapeHtml(c.category)}</span>
                </div>
                <p class="course-summary">${escapeHtml(c.summary)}</p>
                <div class="course-meta">
                    <span>${escapeHtml(c.instructor) || 'No. Q Team'}</span>
                    <span>${c.lessons || 0} lessons</span>
                    <span>${c.hours || 0}h</span>
                    <span>${escapeHtml(c.level) || 'All Levels'}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// ==================== COURSE DETAIL ====================
async function loadCourseDetail() {
    const params = new URLSearchParams(window.location.search);
    const courseId = parseInt(params.get('id'));
    const container = document.getElementById('courseDetailContainer');

    let course = coursesData.find(c => c.id === courseId);
    if (!course) {
        course = await fetchCourseDetail(courseId);
    }

    if (!course) {
        container.innerHTML = '<h2>Course not found.</h2>';
        return;
    }

    const modules = course.modules || [];
    const reviews = course.reviews || [];

    container.innerHTML = `
        <div class="course-detail-hero">
            <div class="detail-left">
                <span class="category-badge">${escapeHtml(course.category)}</span>
                <h1>${escapeHtml(course.name)}</h1>
                <div class="rating-box">
                    <span class="rating-num">${course.rating}</span>
                    <span class="stars">${'&#9733;'.repeat(Math.floor(course.rating))}</span>
                    <span class="rating-count">(${course.rating_count ? course.rating_count.toLocaleString() : '0'} ratings)</span>
                </div>
                <div class="instructor">Instructor: <strong>${escapeHtml(course.instructor) || 'No. Q Team'}</strong></div>
                <p class="description">${escapeHtml(course.summary)}</p>
                <div class="course-curriculum">
                    <h2>What You'll Learn</h2>
                    <div class="module-list">
                        ${modules.map((mod, idx) => `
                            <div class="module-item">
                                <span class="module-number">${idx+1}</span>
                                <span>${escapeHtml(typeof mod === 'string' ? mod : mod.title || mod.name)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="instructor-bio">
                    <div class="avatar">${avatarInitial(course.instructor, 'N')}</div>
                    <div class="bio-text">
                        <h4>About ${escapeHtml(course.instructor) || 'No. Q Team'}</h4>
                        <p>${escapeHtml(course.instructor_bio) || 'Expert instructor at No. Q.'}</p>
                    </div>
                </div>
                <div class="reviews-section">
                    <h2>Student Reviews</h2>
                    ${reviews.map(r => `
                        <div class="review-item">
                            <div class="review-avatar">${avatarInitial(r.name, 'A')}</div>
                            <div class="review-content">
                                <div class="review-name">${escapeHtml(r.name) || 'Anonymous'}</div>
                                <div class="review-rating">${'&#9733;'.repeat(r.rating)}${'&#9734;'.repeat(5-r.rating)}</div>
                                <p class="review-text">${escapeHtml(r.text || r.comment) || ''}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="detail-right">
                <div class="detail-card">
                    <div class="price">$${course.price} ${course.original_price ? '<span class="original">$' + course.original_price + '</span>' : ''}</div>
                    <button class="btn btn-primary btn-lg enroll-btn" onclick="attemptCourse(${course.id})">Attempt Course</button>
                    <div class="course-stats">
                        <span>${course.lessons || 0} lessons</span>
                        <span>${course.hours || 0} hours of content</span>
                        <span>${course.level || 'All Levels'}</span>
                        <span>English</span>
                        <span>Lifetime access</span>
                        <span>Access on mobile</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function attemptCourse(courseId) {
    if (!currentUser) {
        alert('Please sign in to attempt this course.');
        window.location.href = 'signup.html';
        return;
    }
    try {
        await apiRequest('/enrollments/', 'POST', { course: courseId });
        alert('You have successfully started this course!');
        window.location.href = 'User_dashboard.html';
    } catch (err) {
        alert((err.data && err.data.error) || 'Failed to enroll. Please try again.');
    }
}

// ==================== DASHBOARD ====================
async function updateDashboard() {
    if (!currentUser) {
        window.location.href = 'signup.html';
        return;
    }
    document.getElementById('dashUserName').textContent = currentUser.name;
    document.getElementById('dashUserEmail').textContent = currentUser.phone;
    document.getElementById('dashAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
    document.getElementById('dashWelcomeName').textContent = currentUser.name.split(' ')[0];

    try {
        const enrolled = await apiRequest('/enrollments/');
        const enrolledList = enrolled.results || enrolled;
        document.getElementById('statEnrolled').textContent = enrolledList.length;
        const completed = enrolledList.filter(e => e.progress >= 100).length;
        document.getElementById('statCompleted').textContent = completed;
        document.getElementById('statHours').textContent = enrolledList.length * 14;
        document.getElementById('statCertificates').textContent = completed;

        const continueList = document.getElementById('continueLearningList');
        const active = enrolledList.filter(e => e.progress < 100);
        if (active.length === 0) {
            continueList.innerHTML = '<p>No courses in progress. <a href="course_list.html">Browse courses</a>.</p>';
        } else {
            continueList.innerHTML = active.slice(0,3).map(enroll => {
                const course = coursesData.find(c => c.id === enroll.course);
                if (!course) return '';
                return `
                    <div class="enrolled-course-item">
                        <div class="course-progress">
                            <div class="progress-name">${escapeHtml(course.name)}</div>
                            <div class="progress-bar"><div class="progress-fill" style="width:${enroll.progress}%;"></div></div>
                        </div>
                        <span class="progress-percent">${enroll.progress}%</span>
                    </div>
                `;
            }).join('');
        }

        const enrolledListEl = document.getElementById('enrolledCoursesList');
        if (enrolledList.length === 0) {
            enrolledListEl.innerHTML = '<p>No courses enrolled yet.</p>';
        } else {
            enrolledListEl.innerHTML = enrolledList.map(enroll => {
                const course = coursesData.find(c => c.id === enroll.course);
                if (!course) return '';
                return `
                    <div class="enrolled-course-item">
                        <div class="course-progress">
                            <div class="progress-name">${escapeHtml(course.name)}</div>
                            <div class="progress-bar"><div class="progress-fill" style="width:${enroll.progress}%;"></div></div>
                        </div>
                        <span class="progress-percent">${enroll.progress}%</span>
                    </div>
                `;
            }).join('');
        }
    } catch (err) {
        console.error('Dashboard error:', err);
    }

    const activityList = document.getElementById('activityList');
    activityList.innerHTML = '<li>System initialized</li>';
}

function showDashSection(section, linkEl) {
    document.querySelectorAll('[id^="dashSection-"]').forEach(el => el.style.display = 'none');
    document.getElementById('dashSection-' + section).style.display = 'block';
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    linkEl.classList.add('active');
}

// ==================== CONTACT & FEEDBACK (API) ====================
async function handleContactSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('contactName').value.trim();
    const email = document.getElementById('contactEmail').value.trim();
    const subject = document.getElementById('contactSubject').value;
    const message = document.getElementById('contactMessage').value.trim();
    if (!name || !email || !subject || !message) {
        alert('Please fill all required fields.');
        return;
    }
    try {
        await apiRequest('/contacts/', 'POST', { name, email, subject, message });
    } catch (err) {
        console.log('Saving locally');
    }
    document.getElementById('contactFormCard').style.display = 'none';
    document.getElementById('contactSuccess').style.display = 'block';
}

function resetContactForm() {
    document.getElementById('contactFormCard').style.display = 'block';
    document.getElementById('contactSuccess').style.display = 'none';
    document.getElementById('contactName').value = '';
    document.getElementById('contactEmail').value = '';
    document.getElementById('contactSubject').value = '';
    document.getElementById('contactMessage').value = '';
    document.getElementById('contactCharCount').textContent = '0';
}

function populateFeedbackCourses() {
    const select = document.getElementById('feedbackCourse');
    if (!select) return;
    select.innerHTML = '<option value="">Choose a course...</option>' +
        coursesData.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
}

function setRating(rating) {
    selectedRating = rating;
    document.getElementById('feedbackRating').value = rating;
    updateStars();
    const texts = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent!'];
    document.getElementById('ratingText').textContent = rating > 0 ? `${rating} - ${texts[rating]}` : 'Click to rate';
}

function hoverRating(rating) {
    const stars = document.querySelectorAll('#ratingStars .star');
    stars.forEach((star, index) => {
        if (index < rating) star.classList.add('hovered');
        else star.classList.remove('hovered');
    });
}

function resetHoverRating() {
    const stars = document.querySelectorAll('#ratingStars .star');
    stars.forEach(star => star.classList.remove('hovered'));
    updateStars();
}

function updateStars() {
    const stars = document.querySelectorAll('#ratingStars .star');
    stars.forEach((star, index) => {
        if (index < selectedRating) star.classList.add('selected');
        else star.classList.remove('selected');
    });
}

async function handleFeedbackSubmit(e) {
    e.preventDefault();
    const courseId = document.getElementById('feedbackCourse').value;
    const rating = parseInt(document.getElementById('feedbackRating').value);
    const message = document.getElementById('feedbackMessage').value.trim();
    if (!courseId || !rating || !message) {
        alert('Please fill all required fields including the rating.');
        return;
    }
    try {
        await apiRequest('/feedbacks/', 'POST', {
            course: courseId,
            rating,
            message,
            recommend: document.querySelector('input[name="recommend"]:checked')?.value || 'yes'
        });
    } catch (err) {
        console.log('Saving locally');
    }
    document.getElementById('feedbackFormCard').style.display = 'none';
    document.getElementById('feedbackSuccess').style.display = 'block';
}

function resetFeedbackForm() {
    document.getElementById('feedbackFormCard').style.display = 'block';
    document.getElementById('feedbackSuccess').style.display = 'none';
    document.getElementById('feedbackCourse').value = '';
    document.getElementById('feedbackMessage').value = '';
    document.getElementById('feedbackRating').value = '0';
    document.getElementById('feedbackCharCount').textContent = '0';
    selectedRating = 0;
    updateStars();
    document.getElementById('ratingText').textContent = 'Click to rate';
}

// ==================== PROFILE PAGE ====================
function initProfilePage() {
    if (!currentUser) {
        window.location.href = 'signup.html';
        return;
    }

    const avatarInput = document.getElementById('avatarInput');
    const avatarImage = document.getElementById('avatarImage');
    const avatarPlaceholder = document.getElementById('avatarPlaceholder');
    const lastNameInput = document.getElementById('lastName');
    const firstNameInput = document.getElementById('firstName');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    const aboutTextarea = document.getElementById('about');
    const aboutCounter = document.getElementById('aboutCharCount');
    const profileForm = document.getElementById('profileForm');
    const saveSuccess = document.getElementById('saveSuccess');
    const maxChars = 500;
    let selectedAvatarFile = null;

    function updateAboutCounter() {
        aboutCounter.textContent = `${aboutTextarea.value.length} / ${maxChars}`;
    }

    function applyProfileData(data) {
        lastNameInput.value = data.last_name || '';
        firstNameInput.value = data.first_name || '';
        emailInput.value = data.email || '';
        phoneInput.value = data.phone || '';
        aboutTextarea.value = data.bio || '';
        updateAboutCounter();

        if (data.avatar) {
            avatarImage.src = data.avatar;
            avatarImage.style.display = 'block';
            avatarPlaceholder.style.display = 'none';
        } else {
            avatarImage.style.display = 'none';
            avatarPlaceholder.style.display = '';
            avatarPlaceholder.textContent = (currentUser.name || currentUser.phone || '؟').charAt(0);
        }
    }

    async function loadProfile() {
        try {
            const data = await apiRequest('/profile/');
            if (data) applyProfileData(data);
        } catch (err) {
            console.error('Failed to load profile:', err);
        }
    }

    if (avatarInput) {
        avatarInput.addEventListener('change', function() {
            const file = this.files[0];
            if (!file) return;
            selectedAvatarFile = file;
            const reader = new FileReader();
            reader.onload = function(ev) {
                avatarImage.src = ev.target.result;
                avatarImage.style.display = 'block';
                avatarPlaceholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        });
    }

    if (aboutTextarea && aboutCounter) {
        aboutTextarea.addEventListener('input', function() {
            if (this.value.length > maxChars) this.value = this.value.substring(0, maxChars);
            updateAboutCounter();
        });
    }

    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const btn = this.querySelector('.btn-submit');
            const originalText = btn.innerHTML;
            btn.innerHTML = '⏳ در حال ذخیره...';
            btn.disabled = true;
            saveSuccess.classList.remove('show');

            const formData = new FormData();
            formData.append('last_name', lastNameInput.value.trim());
            formData.append('first_name', firstNameInput.value.trim());
            formData.append('email', emailInput.value.trim());
            formData.append('phone', phoneInput.value.trim());
            formData.append('bio', aboutTextarea.value.trim());
            if (selectedAvatarFile) formData.append('avatar', selectedAvatarFile);

            try {
                const token = localStorage.getItem('noqToken');
                const res = await fetch(`${API_BASE}/profile/`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Token ${token}` },
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'خطا در ذخیره‌سازی اطلاعات.');

                applyProfileData(data);
                selectedAvatarFile = null;

                currentUser.name = `${data.last_name} ${data.first_name}`.trim() || data.phone;
                currentUser.phone = data.phone;
                localStorage.setItem('noqUser', JSON.stringify(currentUser));
                updateNavAuth();

                btn.innerHTML = '✅ ذخیره شد!';
                btn.style.background = 'var(--success)';
                saveSuccess.classList.add('show');
            } catch (err) {
                btn.innerHTML = '❌ خطا';
                btn.style.background = 'var(--danger)';
                alert(err.message || 'خطا در ذخیره‌سازی اطلاعات.');
            }

            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
                btn.style.background = '';
            }, 1200);
        });
    }

    loadProfile();
}

// ==================== ADMIN PANEL ====================
const ADMIN_SECTION_TITLES = {
    overview: { title: '📊 نمای کلی', sub: 'خلاصه وضعیت سیستم و کاربران' },
    finance: { title: '💰 گزارش مالی', sub: 'وضعیت درآمد، هزینه و تراکنش‌ها' },
    users: { title: '👥 گزارش کاربران', sub: 'آمار و تحلیل رفتار کاربران' },
    messages: { title: '✉️ پیام‌ها', sub: 'مشاهده و مدیریت پیام‌های دریافتی' },
    feedback: { title: '⭐ بازخوردها', sub: 'نظرات و امتیازات کاربران' },
};

function toggleAdminSidebar() {
    document.getElementById('adminSidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('open');
}

function closeAdminSidebar() {
    document.getElementById('adminSidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
}

function navigateToAdminSection(sectionId) {
    document.querySelectorAll('.admin-sidebar .nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === sectionId);
    });
    document.querySelectorAll('.dash-section').forEach(section => section.classList.remove('active'));
    const target = document.getElementById(`section-${sectionId}`);
    if (target) target.classList.add('active');

    const info = ADMIN_SECTION_TITLES[sectionId];
    if (info) {
        document.getElementById('mainPageTitle').textContent = info.title;
        document.getElementById('mainPageSub').textContent = info.sub;
    }
    if (window.innerWidth <= 768) closeAdminSidebar();
}

function renderAdminMessageItem(m) {
    const onclick = m.is_read ? '' : `onclick="markAdminMessageRead(${m.id})"`;
    return `
        <div class="message-item" data-message-id="${m.id}" ${onclick}>
            <div class="msg-avatar">${avatarInitial(m.name)}</div>
            <div class="msg-content">
                <div class="msg-sender">${escapeHtml(m.name)}</div>
                <div class="msg-preview">${escapeHtml(m.preview)}</div>
            </div>
            <span class="msg-time">${escapeHtml(m.time)}</span>
            <span class="msg-status ${m.is_read ? 'read' : 'unread'}"></span>
        </div>
    `;
}

async function markAdminMessageRead(id) {
    try {
        await apiRequest(`/admin/messages/${id}/read/`, 'PATCH');
    } catch (err) {
        console.error('Failed to mark message as read:', err);
        return;
    }

    const item = document.querySelector(`.message-item[data-message-id="${id}"]`);
    if (item) {
        item.removeAttribute('onclick');
        const dot = item.querySelector('.msg-status');
        if (dot) { dot.classList.remove('unread'); dot.classList.add('read'); }
    }

    const badge = document.getElementById('sidebarMessageBadge');
    const remaining = Math.max((parseInt(badge?.textContent, 10) || 1) - 1, 0);
    if (badge) badge.textContent = remaining;
    const statMessages = document.getElementById('statMessages');
    if (statMessages) statMessages.textContent = remaining;
    const messagesBadgeCount = document.getElementById('messagesBadgeCount');
    if (messagesBadgeCount) messagesBadgeCount.textContent = `${remaining} نخوانده`;
}

function renderAdminFeedbackItem(f) {
    const stars = Array.from({ length: 5 }, (_, i) => `<span class="star${i < f.rating ? '' : ' empty'}">★</span>`).join('');
    return `
        <div class="feedback-item">
            <div class="fb-avatar">${avatarInitial(f.name)}</div>
            <div class="fb-content">
                <div class="fb-name">${escapeHtml(f.name)}</div>
                <div class="fb-text">${escapeHtml(f.text)}</div>
                <div class="fb-rating">${stars}</div>
            </div>
        </div>
    `;
}

async function initAdminPage() {
    if (!currentUser || !currentUser.is_staff) {
        window.location.href = 'base.html';
        return;
    }

    document.getElementById('adminAvatar').textContent = (currentUser.name || '?').charAt(0).toUpperCase();
    document.getElementById('financeDate').textContent = new Date().toLocaleDateString('fa-IR');

    // System logs need is_superuser (stricter than the rest of this panel),
    // so hide the entry points rather than send non-superuser staff to a
    // page that will just bounce them back.
    if (!currentUser.is_superuser) {
        document.getElementById('sidebarLogLink')?.remove();
        document.getElementById('topbarLogLink')?.remove();
    }

    document.querySelectorAll('.admin-sidebar .nav-item[data-section]').forEach(item => {
        item.addEventListener('click', function() {
            navigateToAdminSection(this.dataset.section);
        });
    });

    let data;
    try {
        data = await apiRequest('/admin/overview/');
    } catch (err) {
        console.error('Failed to load admin overview:', err);
        // Covers both a stale cached is_staff=true from before a permission
        // change, and a stale login predating the is_staff field entirely.
        window.location.href = 'base.html';
        return;
    }
    if (!data) return;

    document.getElementById('statActiveUsers').textContent = data.stats.active_users;
    document.getElementById('statRevenue').textContent = `$${data.stats.total_revenue.toLocaleString()}`;
    document.getElementById('statMessages').textContent = data.stats.new_messages;
    document.getElementById('statFeedback').textContent = data.stats.feedback_count;

    document.getElementById('logCountInfo').textContent = data.log_summary.INFO || 0;
    document.getElementById('logCountWarning').textContent = data.log_summary.WARNING || 0;
    document.getElementById('logCountError').textContent = data.log_summary.ERROR || 0;
    const issueCount = (data.log_summary.WARNING || 0) + (data.log_summary.ERROR || 0);
    const sidebarLogBadge = document.getElementById('sidebarLogBadge');
    if (sidebarLogBadge) sidebarLogBadge.textContent = issueCount;

    document.getElementById('financeIncome').textContent = `$${data.finance.total_income.toLocaleString()}`;
    document.getElementById('financeExpenses').textContent = `$${data.finance.total_expenses.toLocaleString()}`;
    document.getElementById('financeNet').textContent = `$${data.finance.net.toLocaleString()}`;
    document.getElementById('transactionList').innerHTML = data.finance.transactions.map(tx => `
        <div class="transaction-item">
            <div class="tx-left">
                <span class="tx-icon ${tx.type}">${tx.type === 'income' ? '↑' : '↓'}</span>
                <div><div style="font-weight:600;">${escapeHtml(tx.label)}</div><div style="font-size:0.7rem;color:var(--text-light);">${escapeHtml(tx.time)}</div></div>
            </div>
            <span class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'}$${tx.amount}</span>
        </div>
    `).join('') || '<p style="color:var(--text-secondary);">تراکنشی ثبت نشده است.</p>';

    const reportLabels = {
        active_percent: 'کاربران فعال',
        profile_completion_percent: 'تکمیل پروفایل',
        enrollment_percent: 'ثبت‌نام در دوره',
        feedback_percent: 'ارسال بازخورد',
    };
    document.getElementById('userReportBars').innerHTML = Object.entries(reportLabels).map(([key, label]) => `
        <div>
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>${label}</span><span>${data.users_report[key]}%</span></div>
            <div style="height:8px; background:var(--surface-hover); border-radius:4px; overflow:hidden;">
                <div style="height:100%; width:${data.users_report[key]}%; background:linear-gradient(90deg,var(--primary),var(--secondary)); border-radius:4px;"></div>
            </div>
        </div>
    `).join('');

    document.getElementById('sidebarMessageBadge').textContent = data.stats.new_messages;
    document.getElementById('messagesBadgeCount').textContent = `${data.stats.new_messages} نخوانده`;
    document.getElementById('overviewMessageList').innerHTML =
        data.messages.slice(0, 3).map(renderAdminMessageItem).join('') || '<p style="color:var(--text-secondary);">پیامی وجود ندارد.</p>';
    document.getElementById('messageList').innerHTML =
        data.messages.map(renderAdminMessageItem).join('') || '<p style="color:var(--text-secondary);">پیامی وجود ندارد.</p>';

    document.getElementById('sidebarFeedbackBadge').textContent = data.stats.feedback_count;
    document.getElementById('feedbackBadgeCount').textContent = data.stats.feedback_count;
    document.getElementById('overviewFeedbackList').innerHTML =
        data.feedback.slice(0, 2).map(renderAdminFeedbackItem).join('') || '<p style="color:var(--text-secondary);">بازخوردی وجود ندارد.</p>';
    document.getElementById('feedbackListFull').innerHTML =
        data.feedback.map(renderAdminFeedbackItem).join('') || '<p style="color:var(--text-secondary);">بازخوردی وجود ندارد.</p>';

    const txForChart = [...data.finance.transactions].reverse();
    new Chart(document.getElementById('financeChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: txForChart.map(tx => tx.time),
            datasets: [{
                label: 'تراکنش (دلار)',
                data: txForChart.map(tx => tx.type === 'income' ? tx.amount : -tx.amount),
                borderColor: '#4361ee',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#4361ee',
                pointBorderColor: '#fff',
                borderWidth: 3,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
            },
        },
    });

    new Chart(document.getElementById('ratingChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['⭐ ۱', '⭐ ۲', '⭐ ۳', '⭐ ۴', '⭐ ۵'],
            datasets: [{
                label: 'تعداد بازخوردها',
                data: [1, 2, 3, 4, 5].map(n => data.rating_distribution[String(n)] || 0),
                backgroundColor: [
                    'rgba(239, 68, 68, 0.7)', 'rgba(245, 158, 11, 0.7)', 'rgba(234, 179, 8, 0.7)',
                    'rgba(16, 185, 129, 0.7)', 'rgba(67, 97, 238, 0.7)',
                ],
                borderColor: ['#ef4444', '#f59e0b', '#eab308', '#10b981', '#4361ee'],
                borderWidth: 2,
                borderRadius: 6,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
            },
        },
    });
}

// ==================== LOG DASHBOARD PAGE ====================
let currentLogPage = 1;
let logRequestSeq = 0;

async function loadLogPage(page) {
    const search = document.getElementById('searchInput').value.trim();
    const level = document.getElementById('levelSelect').value;
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (level) params.set('level', level);
    params.set('page', page);

    // Guards against out-of-order responses (e.g. a fast double-click on
    // Next) overwriting the table with a stale page.
    const requestId = ++logRequestSeq;

    let data;
    try {
        data = await apiRequest(`/admin/logs/?${params.toString()}`);
    } catch (err) {
        console.error('Failed to load logs:', err);
        window.location.href = 'base.html';
        return;
    }
    if (!data || requestId !== logRequestSeq) return;

    currentLogPage = data.page;
    const tbody = document.getElementById('logTableBody');
    const emptyState = document.getElementById('emptyState');

    if (data.results.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
        tbody.innerHTML = data.results.map(log => `
            <tr>
                <td>${escapeHtml(log.time)}</td>
                <td><span class="badge ${escapeHtml(log.level)}">${escapeHtml(log.level)}</span></td>
                <td>${escapeHtml(log.logger_name)}</td>
                <td>${escapeHtml(log.message)}</td>
            </tr>
        `).join('');
    }

    document.getElementById('logPaginationSummary').textContent = data.count
        ? `Showing ${data.start_index}-${data.end_index} of ${data.count} entries`
        : 'Showing 0 of 0 entries';
    document.getElementById('logPrevBtn').disabled = !data.has_previous;
    document.getElementById('logNextBtn').disabled = !data.has_next;
}

function filterLogTable() {
    loadLogPage(1);
}

function resetLogFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('levelSelect').value = '';
    loadLogPage(1);
}

function goToLogPage(page) {
    if (page < 1) return;
    loadLogPage(page);
}

async function initLogDashboardPage() {
    // Stricter than the rest of the admin panel on purpose: system logs can
    // contain stack traces/internals, so this matches the superuser-only
    // bar the legacy /logs/ view already enforces server-side.
    if (!currentUser || !currentUser.is_superuser) {
        window.location.href = 'base.html';
        return;
    }
    await loadLogPage(1);
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async function() {
    updateNavAuth();

    const page = getPageName();

    if (page === 'base.html' || page === '' || page === 'index.html') {
        await fetchCourses();
    } else if (page === 'course_list.html') {
        await fetchCourses();
        const params = new URLSearchParams(window.location.search);
        const category = params.get('category');
        const search = params.get('search');
        if (category) document.getElementById('categoryFilter').value = category;
        if (search) document.getElementById('coursesSearchInput').value = search;
        filterCourses();
    } else if (page === 'course.html') {
        await fetchCourses();
        loadCourseDetail();
    } else if (page === 'User_dashboard.html') {
        await fetchCourses();
        updateDashboard();
    } else if (page === 'signup.html') {
        switchAuthTab('signin');
    } else if (page === 'feedback.html') {
        await fetchCourses();
        populateFeedbackCourses();
        updateStars();
    } else if (page === 'contact_us.html') {
        const msgInput = document.getElementById('contactMessage');
        if (msgInput) {
            msgInput.addEventListener('input', function() {
                document.getElementById('contactCharCount').textContent = this.value.length;
            });
        }
    } else if (page === 'profile_alter.html') {
        initProfilePage();
    } else if (page === 'admin_dashboard.html') {
        await initAdminPage();
    } else if (page === 'log_dashboard.html') {
        await initLogDashboardPage();
    }

    const fbMsg = document.getElementById('feedbackMessage');
    if (fbMsg) {
        fbMsg.addEventListener('input', function() {
            document.getElementById('feedbackCharCount').textContent = this.value.length;
        });
    }

    window.addEventListener('scroll', () => {
        const navbar = document.getElementById('navbar');
        if (navbar && window.scrollY > 20) navbar.classList.add('scrolled');
        else if (navbar) navbar.classList.remove('scrolled');
    });
});
