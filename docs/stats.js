async function loadQuiz(){
  const res = await fetch('quiz.json', { cache: 'no-store' });
  if(!res.ok){
    throw new Error(`Failed to load quiz.json (${res.status})`);
  }
  return res.json();
}

function qs(sel){return document.querySelector(sel)}

function getLocalDateKey(){
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function initSupabase(){
  const config = window.SUPABASE_CONFIG || {};
  if(!window.supabase || !config.url || !config.anonKey) return null;
  return window.supabase.createClient(config.url, config.anonKey);
}

function collectProfessors(data){
  const professors = [];
  const seen = new Set();

  if(data && data.results && typeof data.results === 'object'){
    Object.keys(data.results).forEach((prof)=>{
      if(!seen.has(prof)){
        seen.add(prof);
        professors.push(prof);
      }
    });
  }

  if(data && Array.isArray(data.questions)){
    data.questions.forEach((q)=>{
      (q.choices || []).forEach((c)=>{
        if(c.points && typeof c.points === 'object'){
          Object.keys(c.points).forEach((prof)=>{
            if(!seen.has(prof)){
              seen.add(prof);
              professors.push(prof);
            }
          });
        } else if(c.maps_to){
          const prof = c.maps_to;
          if(prof && !seen.has(prof)){
            seen.add(prof);
            professors.push(prof);
          }
        }
      });
    });
  }

  return professors;
}

function setStatus(message, isError){
  const status = qs('#chart-status');
  if(!status) return;
  status.textContent = message || '';
  status.style.color = isError ? '#f59e0b' : '';
}

function buildChart(professors, data){
  const container = qs('#chart');
  if(!container) return {};
  container.innerHTML = '';
  const elements = {};

  professors.forEach((prof, idx)=>{
    const item = document.createElement('div');
    item.className = 'chart-item';
    item.style.setProperty('--i', idx);

    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    const fill = document.createElement('div');
    fill.className = 'chart-bar-fill';
    const count = document.createElement('div');
    count.className = 'chart-count';
    count.textContent = '0';
    bar.appendChild(fill);
    bar.appendChild(count);

    const photo = document.createElement('img');
    photo.className = 'chart-photo';
    const info = data.results && typeof data.results[prof] === 'object' ? data.results[prof] : null;
    photo.src = info && info.image ? info.image : '';
    photo.alt = prof;
    photo.loading = 'lazy';
    photo.addEventListener('error', ()=>{
      photo.style.display = 'none';
    });

    const name = document.createElement('div');
    name.className = 'chart-name';
    name.textContent = prof;

    item.appendChild(bar);
    item.appendChild(photo);
    item.appendChild(name);
    container.appendChild(item);

    elements[prof] = { fill, count };
  });

  return elements;
}

function updateChart(elements, counts){
  const values = Object.values(counts);
  const max = Math.max(0, ...values);
  let total = 0;

  Object.entries(elements).forEach(([prof, el])=>{
    const count = counts[prof] || 0;
    total += count;
    el.count.textContent = String(count);
    const ratio = max > 0 ? count / max : 0;
    const height = ratio === 0 ? 6 : Math.max(10, Math.round(ratio * 100));
    el.fill.style.height = `${height}%`;
  });

  const empty = qs('#chart-empty');
  if(empty) empty.style.display = total === 0 ? '' : 'none';
}

async function loadDailyCounts(client, dateKey, counts){
  const { data, error } = await client
    .from('quiz_responses')
    .select('id, winner')
    .eq('quiz_date', dateKey);
  if(error){
    throw error;
  }

  data.forEach((row)=>{
    if(row.winner in counts) counts[row.winner] += 1;
  });
  return data.map((row)=>row.id).filter(Boolean);
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const dateKey = getLocalDateKey();
  const dateEl = qs('#stats-date');
  if(dateEl) dateEl.textContent = dateKey;

  let data;
  try{
    data = await loadQuiz();
  }catch(err){
    console.error(err);
    setStatus('Failed to load quiz data.', true);
    return;
  }

  const professors = collectProfessors(data);
  if(!professors.length){
    setStatus('No professor data available.', true);
    return;
  }

  const chartElements = buildChart(professors, data);
  const chartCounts = {};
  professors.forEach((prof)=>{ chartCounts[prof] = 0; });
  updateChart(chartElements, chartCounts);
  document.body.classList.add('is-loaded');

  const supabaseClient = initSupabase();
  if(!supabaseClient){
    setStatus('Configure Supabase to enable live stats.', true);
    return;
  }

  const seenResponseIds = new Set();
  try{
    const ids = await loadDailyCounts(supabaseClient, dateKey, chartCounts);
    ids.forEach((id)=>seenResponseIds.add(id));
    updateChart(chartElements, chartCounts);
    setStatus('Live updates enabled.', false);
  }catch(error){
    setStatus(`Failed to load stats: ${error.message}`, true);
    return;
  }

  supabaseClient
    .channel('quiz-responses-stats')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'quiz_responses', filter: `quiz_date=eq.${dateKey}` },
      (payload)=>{
        const row = payload.new || {};
        if(row.id && seenResponseIds.has(row.id)) return;
        if(row.id) seenResponseIds.add(row.id);
        if(row.winner in chartCounts){
          chartCounts[row.winner] += 1;
          updateChart(chartElements, chartCounts);
        }
      }
    )
    .subscribe();
});
