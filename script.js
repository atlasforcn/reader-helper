document.addEventListener('DOMContentLoaded', function() {
    // 獲取DOM元素
    const inputText = document.getElementById('inputText');
    const processBtn = document.getElementById('processBtn');
    const textDisplay = document.getElementById('textDisplay');
    const readingSection = document.getElementById('readingSection');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const resetBtn = document.getElementById('resetBtn');
    const autoReadSpeed = document.getElementById('autoReadSpeed');
    const focusMode = document.getElementById('focusMode');
    
    let lines = [];
    let currentLineIndex = 0;
    let autoReadInterval = null;
    
    // 處理文字按鈕點擊事件
    processBtn.addEventListener('click', function() {
        const text = inputText.value.trim();
        if (text) {
            processText(text);
            readingSection.style.display = 'block';
            // 滾動到閱讀區域
            readingSection.scrollIntoView({ behavior: 'smooth' });
        }
    });
    
    // 處理文字，根據句號、驚嘆號和刪節號分行，並考慮行長度
    function processText(text) {
        // 先使用標點符號進行初步分割
        const punctuationSplit = text.split(/(?<=[。！？])\s*|(?<=\.{3})\s*|(?<=…)\s*/);
        
        // 過濾空行
        let initialLines = punctuationSplit.filter(line => line.trim() !== '');
        
        // 進一步處理行長度
        lines = [];
        
        for (let line of initialLines) {
            // 如果行長度超過40個字符，嘗試在標點符號處分行
            if (line.length > 40) {
                const segments = splitLongLine(line);
                lines = lines.concat(segments);
            } else {
                lines.push(line);
            }
        }
        
        // 合併過短的行
        lines = mergeTooShortLines(lines);
        
        // 重置當前行索引
        currentLineIndex = 0;
        
        // 顯示分行後的文字
        displayLines();
        
        // 高亮第一行
        highlightCurrentLine();
        
        // 停止任何正在進行的自動閱讀
        stopAutoRead();
    }
    
    // 分割過長的行
    function splitLongLine(line) {
        const result = [];
        let remainingText = line;
        
        // 檢查是否有引號包圍的內容
        const quoteMatches = [];
        const quoteRegex = /「([^」]*)」|"([^"]*)"|\(([^)]*)\)/g;
        let quoteMatch;
        
        while ((quoteMatch = quoteRegex.exec(line)) !== null) {
            quoteMatches.push({
                start: quoteMatch.index,
                end: quoteMatch.index + quoteMatch[0].length - 1,
                text: quoteMatch[0]
            });
        }
        
        // 檢查數字序列
        const numberMatches = [];
        const numberRegex = /\d+/g;
        let numberMatch;
        
        while ((numberMatch = numberRegex.exec(line)) !== null) {
            numberMatches.push({
                start: numberMatch.index,
                end: numberMatch.index + numberMatch[0].length - 1,
                text: numberMatch[0]
            });
        }
        
        // 標點符號正則表達式（包括中文和英文標點）
        const punctuationRegex = /[，。！？：；、,.!?:;]/g;
        
        while (remainingText.length > 40) {
            // 找出所有標點符號的位置
            const punctuations = [];
            let match;
            const tempRegex = new RegExp(punctuationRegex);
            
            while ((match = tempRegex.exec(remainingText)) !== null) {
                // 檢查這個標點符號是否在引號內
                const currentPos = match.index;
                let isInQuote = false;
                
                for (const quote of quoteMatches) {
                    // 計算相對於原始字符串的位置
                    const originalPos = line.length - remainingText.length + currentPos;
                    if (originalPos > quote.start && originalPos < quote.end) {
                        isInQuote = true;
                        break;
                    }
                }
                
                if (!isInQuote) {
                    punctuations.push(match.index);
                }
            }
            
            // 找到最接近40字符的標點符號位置
            let splitIndex = -1;
            for (let i = 0; i < punctuations.length; i++) {
                if (punctuations[i] >= 20 && punctuations[i] <= 40) {
                    splitIndex = punctuations[i] + 1; // +1 包含標點符號
                    break;
                }
            }
            
            // 如果沒有找到合適的標點符號，檢查是否有引號或數字
            if (splitIndex === -1) {
                // 檢查40字符處是否在引號內或數字序列中
                let isInSpecialContent = false;
                let specialContentEndPos = -1;
                
                // 檢查引號
                for (const quote of quoteMatches) {
                    const relativeStart = quote.start - (line.length - remainingText.length);
                    const relativeEnd = quote.end - (line.length - remainingText.length);
                    
                    // 如果40字符處在引號內，則在引號結束後分割
                    if (relativeStart < 40 && relativeEnd >= 40) {
                        isInSpecialContent = true;
                        specialContentEndPos = relativeEnd + 1;
                        break;
                    }
                }
                
                // 如果不在引號內，檢查是否在數字序列中
                if (!isInSpecialContent) {
                    for (const num of numberMatches) {
                        const relativeStart = num.start - (line.length - remainingText.length);
                        const relativeEnd = num.end - (line.length - remainingText.length);
                        
                        // 如果40字符處在數字序列中，則在數字序列結束後分割
                        if (relativeStart < 40 && relativeEnd >= 40) {
                            isInSpecialContent = true;
                            specialContentEndPos = relativeEnd + 1;
                            break;
                        }
                    }
                }
                
                // 如果在特殊內容中，使用特殊內容的結束位置作為分割點
                if (isInSpecialContent && specialContentEndPos > 0) {
                    splitIndex = specialContentEndPos;
                } else {
                    // 如果不在特殊內容中，尋找下一個標點符號
                    if (punctuations.length > 0) {
                        // 找到第一個大於40的標點符號位置
                        for (let i = 0; i < punctuations.length; i++) {
                            if (punctuations[i] > 40) {
                                splitIndex = punctuations[i] + 1;
                                break;
                            }
                        }
                    }
                    
                    // 如果仍然沒有找到合適的分割點，就在40字符處強制分割
                    if (splitIndex === -1) {
                        splitIndex = 40;
                    }
                }
            }
            
            // 分割文本
            result.push(remainingText.substring(0, splitIndex));
            remainingText = remainingText.substring(splitIndex);
            
            // 如果剩餘文本長度小於等於40，直接添加並結束循環
            if (remainingText.length <= 40) {
                result.push(remainingText);
                break;
            }
        }
        
        // 如果循環結束後還有剩餘文本，添加到結果中
        if (remainingText.length > 0 && result[result.length - 1] !== remainingText) {
            result.push(remainingText);
        }
        
        return result;
    }
    
    // 合併過短的行
    function mergeTooShortLines(inputLines) {
        const result = [];
        let i = 0;
        
        while (i < inputLines.length) {
            let currentLine = inputLines[i];
            
            // 如果當前行少於20個字符且不是最後一行
            if (currentLine.length < 20 && i < inputLines.length - 1) {
                // 與下一行合併
                currentLine += inputLines[i + 1];
                i += 2; // 跳過下一行
            } else {
                i += 1;
            }
            
            result.push(currentLine);
        }
        
        return result;
    }
    
    // 顯示分行後的文字
    function displayLines() {
        textDisplay.innerHTML = '';
        lines.forEach((line, index) => {
            const lineElement = document.createElement('div');
            lineElement.className = 'text-line';
            lineElement.id = `line-${index}`;
            lineElement.textContent = line;
            textDisplay.appendChild(lineElement);
        });
    }
    
    // 高亮當前行
    function highlightCurrentLine() {
        // 移除所有行的高亮
        document.querySelectorAll('.text-line').forEach(line => {
            line.classList.remove('highlighted');
        });
        
        // 高亮當前行
        if (lines.length > 0) {
            const currentLine = document.getElementById(`line-${currentLineIndex}`);
            if (currentLine) {
                currentLine.classList.add('highlighted');
                // 確保當前行在視窗中可見
                currentLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        
        // 應用焦點模式
        applyFocusMode();
    }
    
    // 上一行按鈕點擊事件
    prevBtn.addEventListener('click', function() {
        if (currentLineIndex > 0) {
            currentLineIndex--;
            highlightCurrentLine();
        }
    });
    
    // 下一行按鈕點擊事件
    nextBtn.addEventListener('click', function() {
        if (currentLineIndex < lines.length - 1) {
            currentLineIndex++;
            highlightCurrentLine();
        }
    });
    
    // 重置按鈕點擊事件
    resetBtn.addEventListener('click', function() {
        currentLineIndex = 0;
        highlightCurrentLine();
        stopAutoRead();
        autoReadSpeed.value = '0';
    });
    
    // 自動閱讀速度變更事件
    autoReadSpeed.addEventListener('change', function() {
        const speed = parseInt(this.value);
        if (speed > 0) {
            startAutoRead(speed);
        } else {
            stopAutoRead();
        }
    });
    
    // 開始自動閱讀
    function startAutoRead(speed) {
        // 先停止任何正在進行的自動閱讀
        stopAutoRead();
        
        // 設置新的自動閱讀間隔
        autoReadInterval = setInterval(function() {
            if (currentLineIndex < lines.length - 1) {
                currentLineIndex++;
                highlightCurrentLine();
            } else {
                // 到達最後一行時停止自動閱讀
                stopAutoRead();
                autoReadSpeed.value = '0';
            }
        }, speed);
    }
    
    // 停止自動閱讀
    function stopAutoRead() {
        if (autoReadInterval) {
            clearInterval(autoReadInterval);
            autoReadInterval = null;
        }
    }
    
    // 鍵盤控制
    document.addEventListener('keydown', function(event) {
        // 只有在閱讀區域顯示時才響應鍵盤事件
        if (readingSection.style.display === 'block') {
            if (event.key === 'ArrowUp' || event.key === 'k') {
                // 上一行
                if (currentLineIndex > 0) {
                    currentLineIndex--;
                    highlightCurrentLine();
                }
            } else if (event.key === 'ArrowDown' || event.key === 'j' || event.key === ' ') {
                // 下一行 (向下箭頭、j鍵或空格)
                if (currentLineIndex < lines.length - 1) {
                    currentLineIndex++;
                    highlightCurrentLine();
                }
            } else if (event.key === 'Home') {
                // 回到第一行
                currentLineIndex = 0;
                highlightCurrentLine();
            } else if (event.key === 'End') {
                // 跳到最後一行
                currentLineIndex = lines.length - 1;
                highlightCurrentLine();
            }
        }
    });
    
    // 添加焦點模式變更事件
    focusMode.addEventListener('change', function() {
        applyFocusMode();
    });
    
    // 應用焦點模式
    function applyFocusMode() {
        const mode = focusMode.value;
        const allLines = document.querySelectorAll('.text-line');
        
        // 移除所有可能的模式類
        allLines.forEach(line => {
            line.classList.remove('blur', 'hide');
        });
        
        // 如果選擇了模糊或遮擋模式，應用到非高亮行
        if (mode !== 'normal') {
            allLines.forEach((line, index) => {
                if (index !== currentLineIndex) {
                    line.classList.add(mode);
                }
            });
        }
    }
}); 