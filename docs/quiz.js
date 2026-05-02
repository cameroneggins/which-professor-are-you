async function loadQuiz(){
  const res = await fetch('quiz.json');
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

function renderImage(src, alt){
  if(!src) return null;
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt || '';
  img.loading = 'lazy';
  return img;
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

function validateQuizData(data){
  data.questions.forEach((q, qi)=>{
    if(q.type !== 'choice') return;
    q.choices.forEach((c)=>{
      if(!c.points) return;
      const sum = Object.values(c.points).map(v=>Number(v || 0)).reduce((a,b)=>a+b, 0);
      if(Math.abs(sum - 10) > 1e-6){
        throw new Error(`Points sum to ${sum} (expected 10) for choice ${c.text} in question ${qi + 1}`);
      }
    });
  });
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
  const data = await loadQuiz();
  validateQuizData(data);
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
      const img = renderImage(q.image, q.text);
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
      const img = renderImage(resultInfo.image, winner);
      if(img) resultMedia.appendChild(img);
    }
    qs('#restart').onclick = ()=>{ index=0; for(const k in scores) scores[k]=0; answerOrder.length=0; for(const k in freeText) delete freeText[k]; qs('#result').style.display='none'; qs('#quiz').style.display=''; showQuestion(); }
  }

  showQuestion();
});
