// Supabase connection setup
// TODO: Replace with your Supabase project URL and anon key.
const SUPABASE_URL = 'https://nyfspikdefnhazljgtes.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZnNwaWtkZWZuaGF6bGpndGVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MTA4MTksImV4cCI6MjA4NDM4NjgxOX0.w1dHDLxChnJ6zEvtXp3YS-P4pakFeThBraiSbgVwzPo';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const supabaseHelpers = {
  async fetchAll(table, select = '*') {
    const { data, error } = await supabaseClient.from(table).select(select);
    if (error) throw error;
    return data || [];
  },
  async insert(table, payload) {
    const { data, error } = await supabaseClient.from(table).insert(payload).select();
    if (error) throw error;
    return data;
  },
  async update(table, payload, match) {
    const { data, error } = await supabaseClient.from(table).update(payload).match(match).select();
    if (error) throw error;
    return data;
  },
  async remove(table, match) {
    const { error } = await supabaseClient.from(table).delete().match(match);
    if (error) throw error;
    return true;
  },
};

window.supabaseClient = supabaseClient;
window.supabaseHelpers = supabaseHelpers;
