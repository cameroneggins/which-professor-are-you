async function loadQuiz(){
  const res = await fetch('quiz.json', { cache: 'no-store' });
  if(!res.ok){
    throw new Error(`Failed to load quiz.json (${res.status})`);
  }
  return res.json();
}

function qs(sel){return document.querySelector(sel)}

function renderChoice(text, idx, onClick){
  const btn = document.createElement('button');
  btn.className = 'choice-btn';
  btn.textContent = text;
  btn.addEventListener('click', () => onClick());
  return btn;
}

function renderImage(src, alt, label){
  if(!src) return null;
  const wrap = document.createElement('div');
  wrap.className = 'media-wrap';

  const img = document.createElement('img');
  img.src = src;
  img.alt = alt || '';
  img.loading = 'lazy';

  const message = document.createElement('div');
  message.className = 'media-error';
  message.style.display = 'none';
  message.textContent = `${label || 'Image'} failed to load: ${src}`;

  img.addEventListener('error', ()=>{
    img.style.display = 'none';
    message.style.display = '';
  });

  wrap.appendChild(img);
  wrap.appendChild(message);
  return wrap;
}

function getResultInfo(data, winner){
  const raw = data.results[winner];
  if(typeof raw === 'string') return { description: raw, image: '' };
  if(raw && typeof raw === 'object') return raw;
  return { description: '', image: '' };
}

function normalizeText(value){
  if(value == null) return '';
  return typeof value === 'string' ? value : String(value);
}

function showFatalError(message){
  qs('#progress').textContent = '0 / 0';
  qs('#question').textContent = message;
  qs('#choices').innerHTML = '';
  qs('#question-media').innerHTML = '';
  qs('#text-input').style.display = 'none';
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

function renderWarnings(warnings){
  if(!warnings || !warnings.length) return;
  const container = qs('#data-warnings');
  if(!container) return;
  container.innerHTML = '';
  const title = document.createElement('h3');
  title.textContent = 'Quiz data warnings';
  const list = document.createElement('ul');
  warnings.forEach((msg)=>{
    const item = document.createElement('li');
    item.textContent = msg;
    list.appendChild(item);
  });
  container.appendChild(title);
  container.appendChild(list);
  container.style.display = '';
}

function validateQuizData(data){
  if(!data || !Array.isArray(data.questions)){
    console.warn('Quiz data is missing a questions array.');
    return ['Quiz data is missing a questions array.'];
  }

  const warnings = [];
  const professors = collectProfessors(data);

  data.questions.forEach((q, qi)=>{
    if(q.type !== 'choice') return;
    const totals = {};
    professors.forEach((prof)=>{ totals[prof] = 0; });

    (q.choices || []).forEach((c)=>{
      if(c.points && typeof c.points === 'object'){
        Object.entries(c.points).forEach(([prof, raw])=>{
          const val = Number(raw ?? 0);
          if(!Number.isFinite(val)){
            warnings.push(`Non-numeric points for ${prof} in '${c.text}' (question ${qi + 1})`);
            return;
          }
          if(!(prof in totals)) totals[prof] = 0;
          totals[prof] += val;
        });
      } else if(c.maps_to){
        const prof = c.maps_to;
        if(!(prof in totals)) totals[prof] = 0;
        totals[prof] += 10;
      }
    });

    Object.entries(totals).forEach(([prof, total])=>{
      if(Math.abs(total - 10) > 1e-6){
        warnings.push(`Question ${qi + 1}: total for ${prof} is ${total} (expected 10)`);
      }
    });
  });

  if(warnings.length){
    console.warn('Quiz data warnings:', warnings);
  }

  return warnings;
}

function computeWinner(scores, order){
  let max = -1;
  for(const k in scores) if(scores[k] > max) max = scores[k];
  const tied = Object.keys(scores).filter(k=>scores[k]===max);
  if(tied.length===1) return tied[0];
  for(let i=order.length-1;i>=0;i--){ if(tied.includes(order[i])) return order[i]; }
  return tied[0];
}

document.addEventListener('DOMContentLoaded', async ()=>{
  let data;
  try{
    data = await loadQuiz();
  }catch(err){
    console.error(err);
    showFatalError('Failed to load quiz data.');
    return;
  }
  const warnings = validateQuizData(data);
  renderWarnings(warnings);
  qs('#title').textContent = data.title;
  qs('#desc').textContent = data.description;

  const total = data.questions.length;
  let index = 0;
  const scores = {};
  for(const k of Object.keys(data.results)) scores[k]=0;
  const answerOrder = [];
  const freeText = {};

  function showQuestion(){
    const q = data.questions[index];
    qs('#progress').textContent = `${index+1} / ${total}`;
    qs('#question').textContent = q.text;
    const questionMedia = qs('#question-media');
    questionMedia.innerHTML = '';
    if(q.image){
      const img = renderImage(q.image, q.text, 'Question image');
      if(img) questionMedia.appendChild(img);
    }
    qs('#choices').innerHTML = '';
    qs('#text-input').style.display = 'none';

    if(q.type === 'choice'){
      q.choices.forEach((c, i)=>{
        const btn = renderChoice(c.text, i, ()=>{
          // scoring: support new `points` map OR legacy `maps_to`
          if(c.points){
            for(const prof in c.points){
              scores[prof] = (scores[prof]||0) + Number(c.points[prof] || 0);
            }
            // record order by highest-scored prof for this choice
            const top = Object.keys(c.points).reduce((a,b)=> c.points[a]>=c.points[b]?a:b);
            answerOrder.push(top);
          } else if(c.maps_to){
            scores[c.maps_to] = (scores[c.maps_to]||0)+10;
            answerOrder.push(c.maps_to);
          } else {
            // unknown format
            console.error('Choice has no scoring information:', c);
          }
          index++;
          if(index<total) showQuestion(); else showResult();
        });
        qs('#choices').appendChild(btn);
      });
    } else if(q.type === 'text'){
      qs('#text-input').style.display = '';
      qs('#free-text').value = '';
      qs('#free-submit').onclick = ()=>{
        freeText[q.text] = qs('#free-text').value.trim() || '(no answer)';
        index++;
        if(index<total) showQuestion(); else showResult();
      }
    }
  }

  function showResult(){
    const winner = computeWinner(scores, answerOrder);
    qs('#quiz').style.display = 'none';
    qs('#result').style.display = '';
    qs('#result-title').textContent = `You are: ${winner}`;
    const resultInfo = getResultInfo(data, winner);
    qs('#result-desc').textContent = normalizeText(resultInfo.description);
    const resultMedia = qs('#result-media');
    resultMedia.innerHTML = '';
    if(resultInfo.image){
      const img = renderImage(resultInfo.image, winner, 'Result image');
      if(img) resultMedia.appendChild(img);
    }
    qs('#restart').onclick = ()=>{ index=0; for(const k in scores) scores[k]=0; answerOrder.length=0; for(const k in freeText) delete freeText[k]; qs('#result').style.display='none'; qs('#quiz').style.display=''; showQuestion(); }
  }

  showQuestion();
});
