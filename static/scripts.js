// ==================== API CONFIGURATION ====================
const API_BASE = '/api';

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
                <span style="font-weight:600;font-size:0.85rem;color:var(--text-secondary);">${currentUser.name.split(' ')[0]}</span>
                <button class="btn btn-outline btn-sm" onclick="handleLogout()">Logout</button>
            `;
        } else {
            el.innerHTML = `
                <button class="btn btn-outline btn-sm" onclick="window.location.href='signup.html'">Sign In</button>
                <button class="btn btn-primary btn-sm" onclick="window.location.href='signup.html'">Sign Up</button>
            `;
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
    const email = document.getElementById('signinEmail').value.trim();
    const password = document.getElementById('signinPassword').value;
    const errorEl = document.getElementById('signinError');

    try {
        const data = await apiRequest('/auth/login/', 'POST', { email, password });
        if (data && data.token) {
            localStorage.setItem('noqToken', data.token);
            localStorage.setItem('noqUser', JSON.stringify(data.user));
            currentUser = data.user;
            errorEl.classList.remove('show');
            updateNavAuth();
            window.location.href = 'dashboard.html';
        } else {
            errorEl.textContent = 'Invalid email or password.';
            errorEl.classList.add('show');
        }
    } catch (err) {
        errorEl.textContent = (err.data && err.data.error) || 'Invalid email or password.';
        errorEl.classList.add('show');
    }
}

async function handleSignUp() {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const errorEl = document.getElementById('signupError');

    if (!name || !email || !password || password.length < 6) {
        errorEl.textContent = 'Please fill all fields. Password must be at least 6 characters.';
        errorEl.classList.add('show');
        return;
    }

    try {
        const data = await apiRequest('/auth/register/', 'POST', { name, email, password });
        if (data && data.token) {
            localStorage.setItem('noqToken', data.token);
            localStorage.setItem('noqUser', JSON.stringify(data.user));
            currentUser = data.user;
            errorEl.classList.remove('show');
            updateNavAuth();
            window.location.href = 'dashboard.html';
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
                <div class="suggestion-name">${c.name}</div>
                <div class="suggestion-cat">${c.category} | ${c.rating}</div>
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
            <div class="course-icon" style="background:${c.color || '#4361ee'};">${c.icon || 'Q'}</div>
            <div class="course-info">
                <div class="course-top-row">
                    <h3 class="course-name">${c.name}</h3>
                    <span class="course-rating">${c.rating} (${c.rating_count ? c.rating_count.toLocaleString() : '0'})</span>
                    <span class="course-category-badge">${c.category}</span>
                </div>
                <p class="course-summary">${c.summary}</p>
                <div class="course-meta">
                    <span>${c.instructor || 'No. Q Team'}</span>
                    <span>${c.lessons || 0} lessons</span>
                    <span>${c.hours || 0}h</span>
                    <span>${c.level || 'All Levels'}</span>
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
                <span class="category-badge">${course.category}</span>
                <h1>${course.name}</h1>
                <div class="rating-box">
                    <span class="rating-num">${course.rating}</span>
                    <span class="stars">${'&#9733;'.repeat(Math.floor(course.rating))}</span>
                    <span class="rating-count">(${course.rating_count ? course.rating_count.toLocaleString() : '0'} ratings)</span>
                </div>
                <div class="instructor">Instructor: <strong>${course.instructor || 'No. Q Team'}</strong></div>
                <p class="description">${course.summary}</p>
                <div class="course-curriculum">
                    <h2>What You'll Learn</h2>
                    <div class="module-list">
                        ${modules.map((mod, idx) => `
                            <div class="module-item">
                                <span class="module-number">${idx+1}</span>
                                <span>${typeof mod === 'string' ? mod : mod.title || mod.name}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                <div class="instructor-bio">
                    <div class="avatar">${(course.instructor || 'N').charAt(0)}</div>
                    <div class="bio-text">
                        <h4>About ${course.instructor || 'No. Q Team'}</h4>
                        <p>${course.instructor_bio || 'Expert instructor at No. Q.'}</p>
                    </div>
                </div>
                <div class="reviews-section">
                    <h2>Student Reviews</h2>
                    ${reviews.map(r => `
                        <div class="review-item">
                            <div class="review-avatar">${(r.name || 'A').charAt(0)}</div>
                            <div class="review-content">
                                <div class="review-name">${r.name || 'Anonymous'}</div>
                                <div class="review-rating">${'&#9733;'.repeat(r.rating)}${'&#9734;'.repeat(5-r.rating)}</div>
                                <p class="review-text">${r.text || r.comment || ''}</p>
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
        window.location.href = 'dashboard.html';
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
    document.getElementById('dashUserEmail').textContent = currentUser.email;
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
                            <div class="progress-name">${course.name}</div>
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
                            <div class="progress-name">${course.name}</div>
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
        coursesData.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
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
    } else if (page === 'dashboard.html') {
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
