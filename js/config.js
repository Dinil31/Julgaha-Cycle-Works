// js/config.js
const PROJECT_URL = "https://nyfspikdefnhazljgtes.supabase.co";
const PROJECT_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZnNwaWtkZWZuaGF6bGpndGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MTA4MTksImV4cCI6MjA4NDM4NjgxOX0.w1dHDLxChnJ6zEvtXp3YS-P4pakFeThBraiSbgVwzPo";

let client = null;

export function initSupabase() {
  if (typeof window.supabase === "undefined") {
    alert("CRITICAL ERROR: Supabase library not loaded. Check internet.");
    return null;
  }
  client = window.supabase.createClient(PROJECT_URL.trim(), PROJECT_KEY.trim());
  console.log("Supabase Initialized.");
  return client;
}

// Safer way to get the client
export function getSupabase() {
  if (!client) return initSupabase();
  return client;
}
