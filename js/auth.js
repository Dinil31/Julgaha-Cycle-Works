// js/auth.js
import { getSupabase } from './config.js';
import { fetchData } from './data.js';
import { showCustomPrompt, showCustomConfirm } from './ui.js';

// --- LOGOUT LOGIC (FIXED FOR MOBILE) ---
export async function handleLogout() {
    const sb = getSupabase();
    
    // 1. Sign out from Supabase
    await sb.auth.signOut();
    
    // 2. Clear ALL local storage (removes session tokens & loginTime)
    localStorage.clear();
    
    // 3. DO NOT RELOAD. Manually switch UI to Login Screen.
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('fade-in');
    document.getElementById('login-section').classList.remove('hidden');

    // 4. Clear Form Inputs
    const emailInput = document.getElementById('email');
    const passInput = document.getElementById('password');
    const btn = document.getElementById('login-btn');
    
    if(emailInput) emailInput.value = ""; // Clear email
    if(passInput) passInput.value = "";   // Clear password
    if(btn) {
        btn.disabled = false;
        btn.innerText = "Let's Ride!";
    }

    console.log("Logged out successfully.");
}

// --- LOGIN LOGIC ---
export async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');
    const msg = document.getElementById('status-msg');

    if (!email || !password) {
        msg.innerText = "Please enter both fields.";
        msg.style.display = "block";
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Verifying...'; // Spinner
    msg.style.display = "none";

    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
        msg.innerText = "Error: " + error.message;
        msg.style.display = "block";
        btn.disabled = false;
        btn.innerText = "Let's Ride!";
    } else {
        localStorage.setItem('loginTime', Date.now()); 
        checkSession();
    }
}

// --- PASSWORD RESET ---
export async function handleResetPassword() {
    const email = await showCustomPrompt("Reset Password", "Please enter your email address to receive a reset link:", "name@example.com");
    if (!email) return;
    const sb = getSupabase();
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.href });
    if (error) await showCustomConfirm("Error", error.message, true);
    else await showCustomConfirm("Success", "Check your email inbox for the password reset link!");
}

// --- CHECK SESSION ---
export async function checkSession() {
    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();

    if (session) {
        // Check 24-hour expiry
        const loginTime = localStorage.getItem('loginTime');
        const oneDay = 24 * 60 * 60 * 1000; 

        if(loginTime && (Date.now() - parseInt(loginTime) > oneDay)) {
            console.log("Session expired. Logging out...");
            handleLogout();
            return;
        }

        // Show Dashboard
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
        document.getElementById('dashboard-section').classList.add('fade-in');

        document.getElementById('user-display').innerText = "Admin"; 

        fetchData();
    } else {
        // Show Login
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
    }
}
