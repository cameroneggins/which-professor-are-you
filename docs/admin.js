async function loadQuiz(){
  const res = await fetch('quiz.json', { cache: 'no-store' });
  if(!res.ok){
    throw new Error(`Failed to load quiz.json (${res.status})`);
  }
  return res.json();
}

function qs(sel){return document.querySelector(sel)}

function initSupabase(){
  const config = window.SUPABASE_CONFIG || {};
  if(!window.supabase || !config.url || !config.anonKey) return null;
  return window.supabase.createClient(config.url, config.anonKey);
}

function getCentralDateKey(resetHour){
  const cutoff = Number.isFinite(resetHour) ? resetHour : 16;
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(now);
  const map = {};
  parts.forEach((part)=>{
    if(part.type !== 'literal') map[part.type] = part.value;
  });

  let year = Number(map.year);
  let month = Number(map.month);
  let day = Number(map.day);
  const hour = Number(map.hour);

  if(Number.isFinite(hour) && hour < cutoff){
    const temp = new Date(Date.UTC(year, month - 1, day));
    temp.setUTCDate(temp.getUTCDate() - 1);
    year = temp.getUTCFullYear();
    month = temp.getUTCMonth() + 1;
    day = temp.getUTCDate();
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function setStatus(message, isError){
  const status = qs('#status');
  if(!status) return;
  status.textContent = message || '';
  status.style.color = isError ? '#b45309' : '';
}

function setResponseCount(count){
  const el = qs('#response-count');
  if(!el) return;
  el.textContent = `${count} response${count === 1 ? '' : 's'}`;
}

function buildQuestionMap(quiz){
  const questions = [];
  const map = {};

  (quiz.questions || []).forEach((q)=>{
    if(q.type !== 'choice') return;
    const entry = {
      text: q.text,
      choices: (q.choices || []).map((c)=>c.text || '(choice)'),
      counts: (q.choices || []).map(()=>0),
      totals: 0
    };
    questions.push(entry);
    map[q.text] = entry;
  });

  return { questions, map };
}

function recordAnswer(entry, answer){
  if(!entry) return;
  const index = typeof answer.choiceIndex === 'number' ? answer.choiceIndex : -1;
  if(index >= 0 && index < entry.counts.length){
    entry.counts[index] += 1;
  } else if(answer.choice){
    const fallback = entry.choices.indexOf(answer.choice);
    if(fallback >= 0){
      entry.counts[fallback] += 1;
    }
  }
  entry.totals += 1;
}

function renderQuestions(container, questions){
  container.innerHTML = '';
  questions.forEach((q)=>{
    const card = document.createElement('div');
    card.className = 'question-card';

    const title = document.createElement('div');
    title.className = 'question-title';
    title.textContent = q.text;
    card.appendChild(title);

    q.choices.forEach((choiceText, idx)=>{
      const row = document.createElement('div');
      row.className = 'option-row';

      const name = document.createElement('div');
      name.className = 'option-name';
      name.textContent = choiceText;

      const bar = document.createElement('div');
      bar.className = 'option-bar';
      const fill = document.createElement('div');
      fill.className = 'option-bar-fill';
      bar.appendChild(fill);

      const value = document.createElement('div');
      value.className = 'option-value';
      value.textContent = '0%';

      row.appendChild(name);
      row.appendChild(bar);
      row.appendChild(value);
      card.appendChild(row);

      q.countElements = q.countElements || [];
      q.countElements[idx] = { fill, value };
    });

    container.appendChild(card);
  });
}

function updateQuestionStats(questions){
  questions.forEach((q)=>{
    q.choices.forEach((_, idx)=>{
      const count = q.counts[idx] || 0;
      const percent = q.totals > 0 ? (count / q.totals) * 100 : 0;
      const element = q.countElements ? q.countElements[idx] : null;
      if(!element) return;
      element.fill.style.width = `${percent.toFixed(1)}%`;
      element.value.textContent = `${percent.toFixed(1)}% (${count})`;
    });
  });
}

async function loadResponses(client, dateKey){
  const { data, error } = await client
    .from('quiz_responses')
    .select('id, answers')
    .eq('quiz_date', dateKey);
  if(error){
    throw error;
  }
  return data || [];
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const container = qs('#question-list');
  const supabaseClient = initSupabase();
  if(!supabaseClient){
    setStatus('Supabase is not configured.', true);
    return;
  }

  let quiz;
  try{
    quiz = await loadQuiz();
  }catch(err){
    console.error(err);
    setStatus('Failed to load quiz data.', true);
    return;
  }

  const { questions, map } = buildQuestionMap(quiz);
  renderQuestions(container, questions);

  const dateKey = getCentralDateKey(16);
  const seenIds = new Set();

  try{
    const rows = await loadResponses(supabaseClient, dateKey);
    rows.forEach((row)=>{
      if(row.id) seenIds.add(row.id);
      const answers = Array.isArray(row.answers) ? row.answers : [];
      answers.forEach((answer)=>{
        if(answer && answer.type === 'choice'){
          recordAnswer(map[answer.question], answer);
        }
      });
    });
    setResponseCount(rows.length);
    updateQuestionStats(questions);
    setStatus('Live updates enabled.', false);
  }catch(error){
    setStatus(`Failed to load stats: ${error.message}`, true);
    return;
  }

  supabaseClient
    .channel('quiz-responses-admin')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'quiz_responses', filter: `quiz_date=eq.${dateKey}` },
      (payload)=>{
        const row = payload.new || {};
        if(row.id && seenIds.has(row.id)) return;
        if(row.id) seenIds.add(row.id);
        const answers = Array.isArray(row.answers) ? row.answers : [];
        answers.forEach((answer)=>{
          if(answer && answer.type === 'choice'){
            recordAnswer(map[answer.question], answer);
          }
        });
        setResponseCount(seenIds.size);
        updateQuestionStats(questions);
      }
    )
    .subscribe();
});
