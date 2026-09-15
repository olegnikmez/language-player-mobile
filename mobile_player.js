window.addEventListener('load', function() {  
  // ==========================================
  // 1. ИНИЦИАЛИЗАЦИЯ И НАСТРОЙКИ (LOCAL STORAGE)
  // ==========================================
  const deepseekApiKeyInput = document.getElementById('deepseekApiKey');
  const deepseekInstructionInput = document.getElementById('deepseekInstruction');
  const selectSl = document.getElementById('sl');
  const selectTl = document.getElementById('tl');
  const stopAfterSubtitleCheckbox = document.getElementById('stopAfterSubtitle');
  const speakOnTapCheckbox = document.getElementById('speakOnTap');

  const defaultInstruction = `Ты строгий лингвистический анализатор. ЗАПРЕЩЕНО использовать любые приветствия, вводные, оценочные или заключительные фразы. Начинай ответ СТРОГО с литературного перевода.

Раздели предложение на короткие логические смысловые блоки (словосочетания, идиомы, грамматические конструкции, предложные группы или отдельные сложные слова). Не дроби неделимые фразы.

Выводи ответ строго по этой структуре:

**Литературный перевод:**
[Полный перевод фразы]

**Разбор:**

**[Смысловой блок]** — [его точное значение именно в этом предложении]
* [Краткое грамматическое пояснение: только самое важное для понимания (начальная форма, падеж, время, управление, тип склонения), краткий перевод каждого слова в контексте 
**[слово]** - (перевод). Без избыточных деталей, каждое слово с новой строки, но без абзаца или пункта]
***
Продолжай этот шаблон для каждого смыслового блока в предложении.`;

  // Загрузка настроек[cite: 1]
  if (deepseekApiKeyInput) deepseekApiKeyInput.value = localStorage.getItem('deepseekApiKey') || '';
  if (deepseekInstructionInput) deepseekInstructionInput.value = localStorage.getItem('deepseekInstruction') || defaultInstruction;
  if (selectSl && localStorage.getItem('selectedSlValue')) selectSl.value = localStorage.getItem('selectedSlValue');
  if (selectTl && localStorage.getItem('selectedTlValue')) selectTl.value = localStorage.getItem('selectedTlValue');
  
  const savedStopAfterSubtitle = localStorage.getItem("stopAfterSubtitleCheckbox");
  if (stopAfterSubtitleCheckbox && savedStopAfterSubtitle !== null) {
    stopAfterSubtitleCheckbox.checked = savedStopAfterSubtitle === "true";
  }

  const savedSpeakOnTap = localStorage.getItem("speakOnTapCheckbox");
  if (speakOnTapCheckbox && savedSpeakOnTap !== null) {
    speakOnTapCheckbox.checked = savedSpeakOnTap === "true";
  }

  // Сохранение настроек при изменении[cite: 1]
  if (deepseekApiKeyInput) deepseekApiKeyInput.addEventListener('change', (e) => localStorage.setItem('deepseekApiKey', e.target.value));
  if (deepseekInstructionInput) deepseekInstructionInput.addEventListener('change', (e) => localStorage.setItem('deepseekInstruction', e.target.value));
  if (selectSl) selectSl.addEventListener('change', (e) => localStorage.setItem('selectedSlValue', e.target.value));
  if (selectTl) selectTl.addEventListener('change', (e) => localStorage.setItem('selectedTlValue', e.target.value));
  if (stopAfterSubtitleCheckbox) stopAfterSubtitleCheckbox.addEventListener('change', function() { localStorage.setItem("stopAfterSubtitleCheckbox", this.checked); });
  if (speakOnTapCheckbox) speakOnTapCheckbox.addEventListener('change', function() { localStorage.setItem("speakOnTapCheckbox", this.checked); });

  // ==========================================
  // 2. НАВИГАЦИЯ МЕЖДУ ЭКРАНАМИ
  // ==========================================
  const playerScreen = document.getElementById('playerScreen');
  const settingsScreen = document.getElementById('settingsScreen');
  
  document.getElementById('btnGoSettings').addEventListener('click', () => {
    playerScreen.classList.add('d-none');
    settingsScreen.classList.remove('d-none');
  });
  
  document.getElementById('btnGoPlayer').addEventListener('click', () => {
    settingsScreen.classList.add('d-none');
    playerScreen.classList.remove('d-none');
  });

  // ==========================================
  // 3. ЗАГРУЗКА ФАЙЛОВ И ПЛЕЕР
  // ==========================================
  const videoFileInput = document.getElementById('videoFile');
  const subtitlesTopInput = document.getElementById('subtitlesTop');
  const subtitlesBottomInput = document.getElementById('subtitlesBottom');
  
  const videoPlayer = document.getElementById('videoPlayer');
  const videoContainerBox = document.getElementById('videoContainerBox');
  const allTopSubsContainer = document.getElementById('allTopSubs');
  const videoSubtitlesBottom = document.getElementById('videoSubtitlesBottom');
  
  let subtitlesTop = [];
  let subtitlesBottom = [];
  let currentSubtitleTopIndex = -1;
  let currentSubtitleBottomIndex = -1;
  
  let fileSize = 0;
  let fileName = '';
  let pauseWas = 0;

  videoFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    fileSize = file.size; 
    fileName = file.name; 

    if (file.type.startsWith('audio/')) {
      videoContainerBox.style.display = 'none';
    } else {
      videoContainerBox.style.display = 'block';
    }

    videoPlayer.src = URL.createObjectURL(file);
    
    let storedCurrentTime = localStorage.getItem(fileName + '_' + fileSize); 
    if (storedCurrentTime) { 
      videoPlayer.currentTime = storedCurrentTime; 
    } 

    // settingsScreen.classList.add('d-none');
    // playerScreen.classList.remove('d-none');
  });

  subtitlesTopInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = (event) => {
      subtitlesTop = parseSrt(event.target.result);
      loadTopSubtitles();
      // settingsScreen.classList.add('d-none');
      // playerScreen.classList.remove('d-none');
    }
  });

  if (subtitlesBottomInput) {
    subtitlesBottomInput.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.readAsText(file);
      reader.onload = (event) => {
        subtitlesBottom = parseSrt(event.target.result);
      }
    });
  }

  // Функция парсинга субтитров (SRT и LRC с зазором)[cite: 1]
  function parseSrt(data) {
    const subtitles = [];
    const lines = data.split(/\r?\n/);
    const isLrc = data.match(/^\[\d{2}:\d{2}\.\d{2,3}\]/m);

    // ЗАЗОР ДЛЯ LRC: Отсекаем последние 0.3 секунды фразы, чтобы не цеплять следующий звук
    const lrcGap = 0.3; 

    if (isLrc) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
        if (match) {
          const minutes = parseInt(match[1], 10);
          const seconds = parseInt(match[2], 10);
          const msStr = match[3].length === 2 ? match[3] + "0" : match[3];
          const milliseconds = parseInt(msStr, 10) / 1000;
          
          const startTime = minutes * 60 + seconds + milliseconds;
          const text = escapeHtml(match[4].trim());
          
          if (text !== '') {
            subtitles.push({ startTime: startTime, endTime: startTime + 5, text: text });
          }
        }
      }
      // Применяем зазор
      for (let i = 0; i < subtitles.length - 1; i++) {
        const nextStart = subtitles[i + 1].startTime;
        subtitles[i].endTime = (nextStart - subtitles[i].startTime > lrcGap) ? nextStart - lrcGap : nextStart;
      }
    } else {
      let startTime, endTime, text;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^\d+$/)) {
        } else if (lines[i].match(/^\d\d:\d\d:\d\d,\d\d\d --> \d\d:\d\d:\d\d,\d\d\d$/)) {
          const times = lines[i].split(' --> ');
          startTime = convertTimeToSeconds(times[0]);
          endTime = convertTimeToSeconds(times[1]);
        } else if (lines[i].trim() === '') {
        } else {
          text = escapeHtml(lines[i]);
          i++;
          while (i < lines.length && lines[i].trim() !== '') {
            text += '\n' + lines[i];
            i++;
          }
          i--;
          if (text && text.trim() !== '') {
            subtitles.push({ startTime: startTime, endTime: endTime, text: text });
          }
        }
      }
    }
    return subtitles;
  }

  function convertTimeToSeconds(time) {
    const parts = time.split(':');
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2].replace(',', '.'));
  }

  function escapeHtml(text) {
    var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
  }

  // Формирование строки субтитров (с правильными кнопками)[cite: 2]
  function wrapWordsInSpan(sentence) {
    const words = sentence.split(" ");
    const wrappedWords = words.map(word => `<span class="toTranslate">${word}</span>`);
    const safeSentence = escapeHtml(sentence);

    const playBtn = `<button type="button" class="btn btn-outline-warning btn-sm rounded-pill px-4 jumpToSentence" title="Слушать">
      <i class="bi bi-play-fill" style="pointer-events: none; font-size: 1.2rem; line-height: 1;"></i>
    </button>`;

    const googleBtn = `<button type="button" class="btn btn-outline-light btn-sm rounded-pill px-4 googleTranslate" sentence="${safeSentence}" title="Перевести">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="pointer-events: none; vertical-align: text-bottom;">
        <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
      </svg>
    </button>`;

    const aiBtn = `<button type="button" class="btn btn-outline-info btn-sm rounded-pill px-4 aiTranslate" sentence="${safeSentence}" title="Разбор">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16" style="pointer-events: none; vertical-align: text-bottom;">
        <path d="M7.657 6.247c.11-.33.576-.33.686 0l.203.61a2.46 2.46 0 0 0 1.585 1.585l.61.203c.33.11.33.576 0 .686l-.61.203a2.46 2.46 0 0 0-1.585 1.585l-.203.61c-.11.33-.576.33-.686 0l-.203-.61a2.46 2.46 0 0 0-1.585-1.585l-.61-.203c-.33-.11-.33-.576 0-.686l.61-.203a2.46 2.46 0 0 0 1.585-1.585l.203-.61zM11.457 4.144c.05-.152.261-.152.311 0l.11.33a1.13 1.13 0 0 0 .727.727l.33.11c.152.05.152.261 0 .311l-.33.11a1.13 1.13 0 0 0-.727.727l-.11.33c-.05.152-.261.152-.311 0l-.11-.33a1.13 1.13 0 0 0-.727-.727l-.33-.11c-.152-.05-.152-.261 0-.311l.33-.11a1.13 1.13 0 0 0 .727-.727l.11-.33z"/>
      </svg>
    </button>`;

    return `
      <div class="d-flex flex-column flex-md-row justify-content-between align-items-center w-100 gap-2 gap-md-3">
        <!-- Фраза: по центру на мобильных, слева на ПК -->
        <div class="text-center text-md-start flex-grow-1" style="line-height: 1.5;">
          ${wrappedWords.join(" ")}
        </div>
        
        <!-- Кнопки: справа в ряд и строго по центру по вертикали -->
        <div class="d-flex justify-content-center align-items-center flex-wrap gap-2 flex-shrink-0">
          ${playBtn} 
          ${googleBtn} 
          ${aiBtn}
        </div>
      </div>
    `;

    /*return `
      <div class="d-flex flex-column flex-md-row justify-content-between align-items-center align-items-md-center w-100 mb-4 mb-md-1 gap-2 gap-md-3">
        <!-- Фраза: по центру на мобильных, слева на ПК -->
        <div class="text-center text-md-start flex-grow-1" style="line-height: 1.5;">
          ${wrappedWords.join(" ")}
        </div>
        
        <!-- Кнопки: под фразой на мобильных, справа в ряд на ПК -->
        <div class="d-flex justify-content-center flex-wrap gap-2 flex-shrink-0">
          ${playBtn} 
          ${googleBtn} 
          ${aiBtn}
        </div>
      </div>
    `;*/

    /*return `
      <div class="d-flex flex-column flex-md-row justify-content-between align-items-center align-items-md-start w-100 mb-3 gap-3">
        <!-- Фраза: по центру на мобильных, слева на ПК -->
        <div class="text-center text-md-start flex-grow-1" style="line-height: 1.8;">
          ${wrappedWords.join(" ")}
        </div>
        
        <!-- Кнопки: под фразой на мобильных, справа в ряд на ПК -->
        <div class="d-flex justify-content-center flex-wrap gap-2 flex-shrink-0">
          ${playBtn} 
          ${googleBtn} 
          ${aiBtn}
        </div>
      </div>
    `;*/

    /*return `
      <div class="mb-3">${wrappedWords.join(" ")}</div>
      <div class="d-flex justify-content-center flex-wrap gap-2 mt-2">
        ${playBtn} 
        ${googleBtn} 
        ${aiBtn}
      </div>
    `;*/  
  }

  function loadTopSubtitles() {
    allTopSubsContainer.innerHTML = '';
    for (let i = 0; i < subtitlesTop.length; i++) {
      const subtitle = subtitlesTop[i];
      const subtitleDiv = document.createElement('div');
      subtitleDiv.innerHTML = wrapWordsInSpan(subtitle.text);
      subtitleDiv.setAttribute('start', subtitle.startTime);
      subtitleDiv.setAttribute('end', subtitle.endTime);
      subtitleDiv.setAttribute('subNumber', i);
      /*subtitleDiv.classList.add('subtitle');
      subtitleDiv.style.marginBottom = '25px';*/ 
      // subtitleDiv.classList.add('subtitle', 'mb-4', 'mb-md-0');
      //subtitleDiv.classList.add('subtitle', 'mb-4', 'mb-md-1', 'border-bottom', 'border-secondary', 'border-opacity-25', 'pb-3', 'pb-md-2');
      subtitleDiv.classList.add('subtitle', 'mb-2', 'mb-md-1', 'border-bottom', 'border-secondary', 'border-opacity-25', 'py-3', 'py-md-2', 'mx-auto');

      // ДОБАВЛЕНО: ограничение ширины для комфортного чтения на ПК
      // subtitleDiv.style.maxWidth = '900px';
      subtitleDiv.style.maxWidth = '80ch';

      allTopSubsContainer.appendChild(subtitleDiv);
    }
  }

  // ==========================================
  // 4. GOOGLE TRANSLATE API И НИЖНЯЯ ПАНЕЛЬ (НАДЕЖНЫЙ XHR КАК В ПК)[cite: 6]
  // ==========================================
  let isTranslationLocked = false;

  function translateGoogle(text, callback) {
    const sl = selectSl ? selectSl.value : 'en';
    const tl = selectTl ? selectTl.value : 'ru';
    
    const xhr = new XMLHttpRequest();
    const url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + sl + "&tl=" + tl + "&dt=t&dt=at&dt=ex&q=" + encodeURIComponent(text.trim());
    
    xhr.open("GET", url, true);
    
    xhr.onload = function() {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          if (response && response[0]) {
            let translation = '';
            for (const transl of response[0]) {
              if (transl[0]) translation += transl[0];
            }
            callback(translation);
          } else {
            callback("Ошибка структуры ответа");
          }
        } catch (e) {
          callback("Ошибка обработки ответа");
        }
      } else if (xhr.status === 429) {
        callback("Лимит запросов Google. Подождите.");
      } else {
        callback("Ошибка сервера: " + xhr.status);
      }
    };
    
    xhr.onerror = function() {
      callback("Блокировка сети (Ошибка CORS / CGNAT)");
    };
    
    xhr.send();
  }

  function showTranslationInBottom(text) {
    isTranslationLocked = true;
    videoSubtitlesBottom.innerHTML = `
      <div class="d-flex justify-content-between align-items-center w-100">
          <div class="text-info fw-bold flex-grow-1 px-2">${text}</div>
          <button type="button" class="btn-close btn-close-white flex-shrink-0" id="closeTransBtn" style="padding: 10px;"></button>
      </div>
    `;
    
    document.getElementById('closeTransBtn').addEventListener('click', (e) => {
       e.stopPropagation();
       isTranslationLocked = false;
       restoreBottomSubtitle();
    });
  }

  function restoreBottomSubtitle() {
    if (currentSubtitleBottomIndex !== -1 && subtitlesBottom[currentSubtitleBottomIndex]) {
      videoSubtitlesBottom.innerHTML = subtitlesBottom[currentSubtitleBottomIndex].text;
    } else {
      videoSubtitlesBottom.innerHTML = '...';
    }
  }

  // ==========================================
  // 5. СИНХРОНИЗАЦИЯ, ПАНЕЛЬ УПРАВЛЕНИЯ И АВТОПАУЗА
  // ==========================================
  const audioProgressBar = document.getElementById('audioProgressBar');
  const currentTimeDisplay = document.getElementById('currentTimeDisplay');
  const durationDisplay = document.getElementById('durationDisplay');
  let oldIndex = -1;

  function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  videoPlayer.addEventListener('timeupdate', () => {
    const currentTime = videoPlayer.currentTime;

    if (videoPlayer.duration) {
      audioProgressBar.value = (currentTime / videoPlayer.duration) * 100;
      currentTimeDisplay.textContent = formatTime(currentTime);
      durationDisplay.textContent = formatTime(videoPlayer.duration);
    }

    for (let i = 0; i < subtitlesTop.length; i++) {
      if (currentTime >= subtitlesTop[i].startTime && currentTime < subtitlesTop[i].endTime) {
        currentSubtitleTopIndex = i;
        break;
      }
    }
    
    currentSubtitleBottomIndex = -1;
    for (let i = 0; i < subtitlesBottom.length; i++) {
      if (currentTime >= subtitlesBottom[i].startTime && currentTime < subtitlesBottom[i].endTime) {
        currentSubtitleBottomIndex = i;
        break;
      }
    }

    if(oldIndex !== currentSubtitleTopIndex) {
      const container = document.getElementById('allTopSubs');
      const cRect = container.getBoundingClientRect();
      
      // Определяем направление движения (вперед или назад)
      const isMovingDown = currentSubtitleTopIndex > oldIndex;

      const subtitlesElements = document.querySelectorAll('.subtitle');
      subtitlesElements.forEach((subtitle) => {
        const subNumber = parseInt(subtitle.getAttribute('subNumber'));
        
        if (subNumber === currentSubtitleTopIndex) {
          subtitle.classList.add('subtitleCurrent');

          // --- НОВАЯ ЛОГИКА УМНОГО СКРОЛЛИНГА ---
          const next1 = subtitle.nextElementSibling;
          const next2 = next1 ? next1.nextElementSibling : null;
          
          const prev1 = subtitle.previousElementSibling;
          const prev2 = prev1 ? prev1.previousElementSibling : null;

          if (isMovingDown) {
            // Движение ВНИЗ: проверяем, видно ли полностью 2 фразы под текущей
            let needsScroll = false;
            
            if (next2) {
              const next2Rect = next2.getBoundingClientRect();
              if (next2Rect.bottom > cRect.bottom) needsScroll = true;
            } else if (next1) {
              const next1Rect = next1.getBoundingClientRect();
              if (next1Rect.bottom > cRect.bottom) needsScroll = true;
            } else {
              const sRect = subtitle.getBoundingClientRect();
              if (sRect.bottom > cRect.bottom) needsScroll = true;
            }

            // Если фразы не помещаются, прокручиваем так, чтобы предыдущая фраза стала первой сверху
            // (таким образом активная станет второй сверху)
            if (needsScroll) {
              if (prev1) {
                prev1.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else {
                subtitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }
          } else {
            // Движение ВВЕРХ: проверяем, видно ли полностью 2 фразы над текущей
            let needsScroll = false;
            
            if (prev2) {
              const prev2Rect = prev2.getBoundingClientRect();
              if (prev2Rect.top < cRect.top) needsScroll = true;
            } else if (prev1) {
              const prev1Rect = prev1.getBoundingClientRect();
              if (prev1Rect.top < cRect.top) needsScroll = true;
            } else {
              const sRect = subtitle.getBoundingClientRect();
              if (sRect.top < cRect.top) needsScroll = true;
            }

            // Если фразы не помещаются, прокручиваем так, чтобы следующая фраза стала последней снизу
            // (таким образом активная станет второй снизу)
            if (needsScroll) {
              if (next1) {
                next1.scrollIntoView({ behavior: 'smooth', block: 'end' });
              } else {
                subtitle.scrollIntoView({ behavior: 'smooth', block: 'end' });
              }
            }
          }
          // --- КОНЕЦ ЛОГИКИ СКРОЛЛИНГА ---

        } else {
          subtitle.classList.remove('subtitleCurrent');
        }
      });
      
      oldIndex = currentSubtitleTopIndex;
      localStorage.setItem(fileName + '_' + fileSize, currentTime);

      if (!isTranslationLocked) {
        restoreBottomSubtitle();
      }
    }

    // =====================================
    // НОВАЯ ЛОГИКА АВТОПАУЗЫ (Опирается на конец фразы с учетом lrcGap)
    // =====================================
    if (stopAfterSubtitleCheckbox && stopAfterSubtitleCheckbox.checked && currentSubtitleTopIndex !== -1) {
      
      // Берем точное время окончания текущей фразы
      const currentEndTime = subtitlesTop[currentSubtitleTopIndex].endTime;
      
      // Буфер безопасности: останавливаем видео за 0.15 секунды до вычисленного конца,
      // чтобы поглотить лаги timeupdate на мобильных устройствах.
      const safetyBuffer = 0.15; 
      
      // Срабатываем, если пересекли границу
      if (currentTime >= (currentEndTime - safetyBuffer)) {
        if (pauseWas === 0) {
          videoPlayer.pause();
          pauseWas = 1;
        }
      } 
      // Сбрасываем флаг только после перехода к следующей фразе
      else if (currentTime < (currentEndTime - safetyBuffer - 0.1)) {
        pauseWas = 0;
      }
    }
  });

  if (audioProgressBar) {
    audioProgressBar.addEventListener('input', (e) => {
      videoPlayer.currentTime = (e.target.value / 100) * videoPlayer.duration;
    });
  }

  // ==========================================
  // 6. МОБИЛЬНЫЕ КНОПКИ ПЛЕЕРА
  // ==========================================
  const playPauseIcon = document.getElementById('playPauseIcon');

  videoPlayer.addEventListener('play', () => {
    if(playPauseIcon) {
        playPauseIcon.classList.remove('bi-play-circle-fill');
        playPauseIcon.classList.add('bi-pause-circle-fill');
    }
  });
  
  videoPlayer.addEventListener('pause', () => {
    if(playPauseIcon) {
        playPauseIcon.classList.remove('bi-pause-circle-fill');
        playPauseIcon.classList.add('bi-play-circle-fill');
    }
  });

  document.getElementById('btnPlayPause').addEventListener('click', () => {
    if (videoPlayer.paused) videoPlayer.play();
    else videoPlayer.pause();
  });

  document.getElementById('btnPrevSub').addEventListener('click', () => {
    const currentSubtitle = document.querySelector('.subtitleCurrent');
    if (currentSubtitle && currentSubtitle.previousElementSibling) {
      videoPlayer.currentTime = parseFloat(currentSubtitle.previousElementSibling.getAttribute('start'));
      videoPlayer.play();
    }
  });

  document.getElementById('btnRepeatSub').addEventListener('click', () => {
    const currentSubtitle = document.querySelector('.subtitleCurrent');
    if (currentSubtitle) {
      videoPlayer.currentTime = parseFloat(currentSubtitle.getAttribute('start'));
      videoPlayer.play();
    }
  });

  document.getElementById('btnNextSub').addEventListener('click', () => {
    const currentSubtitle = document.querySelector('.subtitleCurrent');
    if (currentSubtitle && currentSubtitle.nextElementSibling) {
      videoPlayer.currentTime = parseFloat(currentSubtitle.nextElementSibling.getAttribute('start'));
      videoPlayer.play();
    }
  });


  // ==========================================
  // 7. ОБРАБОТКА ТАПОВ ПО ТЕКСТУ И ИКОНКАМ
  // ==========================================
  const aiOffcanvasElement = document.getElementById('aiOffcanvas');
  const aiOffcanvas = aiOffcanvasElement ? new bootstrap.Offcanvas(aiOffcanvasElement) : null;
  const aiOffcanvasBody = document.getElementById('aiOffcanvasBody');

  allTopSubsContainer.addEventListener('click', async function(event) {
    
    // А) Быстрый переход к предложению (Иконка Play)
    const jumpBtn = event.target.closest('.jumpToSentence');
    if (jumpBtn) {
      const subtitleDiv = jumpBtn.closest('.subtitle');
      if (subtitleDiv) {
        videoPlayer.currentTime = parseFloat(subtitleDiv.getAttribute('start'));
        videoPlayer.play();
      }
      return;
    }

    // ОБЩАЯ ПАУЗА: Останавливаем видео перед любым другим действием (перевод фразы, слова или разбор AI)
    if (!videoPlayer.paused) videoPlayer.pause();

    // Б) Перевод ВСЕГО предложения в Google
    const googleBtn = event.target.closest('.googleTranslate');
    if (googleBtn) {
      const sentence = googleBtn.getAttribute('sentence');
      showTranslationInBottom("Анализ Google...");
      translateGoogle(sentence, (result) => showTranslationInBottom(result));
      return;
    }

    // В) Тап по слову: Перевод + Озвучка
    if (event.target.classList.contains('toTranslate')) {
      // Останавливаем плеер перед любым действием
      // if (!videoPlayer.paused) videoPlayer.pause();

      const textToSpeak = event.target.textContent;
      
      showTranslationInBottom("...");
      translateGoogle(textToSpeak, (result) => showTranslationInBottom(result));

      if (speakOnTapCheckbox && speakOnTapCheckbox.checked) {
        const language = selectSl ? selectSl.value : 'en'; 
        
        // Очищаем очередь, чтобы избежать заикания при быстрых тапах
        window.speechSynthesis.cancel(); 
        
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = language;
        
        const voices = window.speechSynthesis.getVoices();
        const targetVoice = voices.find(v => v.lang.startsWith(language));
        if (targetVoice) utterance.voice = targetVoice;
        
        speechSynthesis.speak(utterance);
      }
    return;
  }

    // Г) Обработка клика по иконке DeepSeek[cite: 6]
    const aiBtn = event.target.closest('.aiTranslate');
    if (aiBtn && aiOffcanvas) {
      // if (!videoPlayer.paused) videoPlayer.pause(); 

      const sentence = aiBtn.getAttribute('sentence');
      const apiKey = deepseekApiKeyInput ? deepseekApiKeyInput.value.trim() : localStorage.getItem('deepseekApiKey');
      const instruction = deepseekInstructionInput ? deepseekInstructionInput.value.trim() : defaultInstruction;

      if (!apiKey) { alert("Введите API ключ DeepSeek в настройках."); return; }

      aiOffcanvas.show();
      aiOffcanvasBody.innerHTML = '<div class="text-center mt-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-3 text-light fw-bold">DeepSeek анализирует...</p></div>';

      try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: instruction },
              { role: 'user', content: sentence }
            ],
            temperature: 0.3
          })
        });

        const data = await response.json();
        if (data.choices && data.choices[0]) {
          const answer = data.choices[0].message.content;
          const htmlAnswer = (typeof marked !== 'undefined') ? marked.parse(answer) : answer.replace(/\n/g, '<br>');
          
          aiOffcanvasBody.innerHTML = `
            <div class="text-info fw-bold mb-3 border-bottom border-secondary pb-2" style="font-size: 1.2rem;">${escapeHtml(sentence)}</div>
            <div class="markdown-body text-light" style="font-size: 1rem; line-height: 1.5;">${htmlAnswer}</div>
          `;
        } else { aiOffcanvasBody.innerHTML = `<div class="alert alert-danger">Ошибка ответа: ${JSON.stringify(data)}</div>`; }
      } catch (error) { aiOffcanvasBody.innerHTML = `<div class="alert alert-danger">Сетевая ошибка: ${error.message}</div>`; }
    }
  });

  // ==========================================
  // 8. ГЛОБАЛЬНЫЕ ГОРЯЧИЕ КЛАВИШИ ДЛЯ ПК
  // ==========================================
  window.addEventListener('keydown', function(e) {
    // Игнорируем нажатия, если пользователь вводит текст в инпуты (в настройках)
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (e.code === 'Space') {
      e.preventDefault(); // Блокируем стандартную прокрутку страницы пробелом
      document.getElementById('btnPlayPause').click(); // Плей/Пауза
    } else if (e.code === 'KeyA') {
      document.getElementById('btnPrevSub').click(); // Назад
    } else if (e.code === 'KeyS') {
      document.getElementById('btnRepeatSub').click(); // Повторить
    } else if (e.code === 'KeyD') {
      document.getElementById('btnNextSub').click(); // Вперед
    }
  });

  // ==========================================
  // ЗАЩИТА ОТ СЛУЧАЙНОГО СВАЙПА "НАЗАД"
  // ==========================================
  
  // Создаем первичную "фейковую" запись в истории
  history.pushState({ page: 'player' }, null, location.href);

  window.addEventListener('popstate', function(event) {
    // Как только пользователь свайпнул "Назад", мы не даем ему уйти 
    // и мгновенно возвращаем фейковую запись обратно
    history.pushState({ page: 'player' }, null, location.href);
    
    // Опционально: можно показать пользователю легкое уведомление, что выход заблокирован
    console.warn("Блокировка случайного выхода назад");
  });

});

// Перехват случайной перезагрузки или закрытия вкладки
window.addEventListener('beforeunload', function (e) {
  // Диалоговое окно появится только если пользователь уже взаимодействовал со страницей (тапнул куда-либо)
  e.preventDefault();
  e.returnValue = ''; 
});