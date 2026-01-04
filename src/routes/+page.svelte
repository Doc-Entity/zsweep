<script lang="ts">
  import { createGrid, placeMines, revealCell, DIRECTIONS, type Cell } from '$lib/minesweeper';
  import { onMount, onDestroy } from 'svelte';
  import { Flag, Bomb, Grid3x3, Wrench, X, Flame, Skull, Flower2, User, LogOut, Clock, Hourglass, Infinity as InfinityIcon, Palette, Search, ChevronRight } from 'lucide-svelte';
  import ResultView from '$lib/ResultView.svelte';
  import { supabase } from '$lib/supabase';
  import { THEMES } from '$lib/themes';
  import { currentTheme } from '$lib/themeStore';

  const GRID_SIZES = [
    { label: '9x9', rows: 9, cols: 9, mines: 10 },
    { label: '16x16', rows: 16, cols: 16, mines: 40 },
    { label: '30x16', rows: 16, cols: 30, mines: 99 }
  ];

  const TIME_OPTIONS = [15, 30, 60, 120];

  // --- SETTINGS ---
  let gameMode: 'time' | 'standard' = 'time'; 
  let currentSize = GRID_SIZES[0]; 
  let timeLimit = 15;
  let customTime = 60;
  let isCustomTime = false;

  // --- COMMAND PALETTE STATE ---
  let showPalette = false;
  let paletteView: 'root' | 'themes' = 'root';
  let searchQuery = '';
  let searchInputEl: HTMLInputElement;

  // --- GAME STATE ---
  let grid: Cell[][] = [];
  let gameState: 'pending' | 'playing' | 'finished' = 'pending';
  let isFirstClick = true; 
  let timer = 0;
  let timerInterval: ReturnType<typeof setInterval> | undefined;
  
  // --- STATS ---
  let minesLeft = 0;
  let totalClicks = 0;
  let clickHistory: number[] = [];
  let clicksThisSecond = 0;
  
  let gridsSolved = 0;
  let gridsPlayed = 0;
  let totalCellsRevealed = 0; 
  let sessionTotalMines = 0; 
  let sessionErrors = 0;     
  let finalAccuracy = 0;
  
  let isMouseDown = false;
  let hoveredCell: { r: number, c: number } | null = null;
  let currentUser: string | null = null;

  $: StatusIcon = (() => {
    if (gameState === 'finished') return Flower2;
    if (isMouseDown && gameState !== 'pending') return Flame;
    return Bomb;
  })();

  // --- FILTERING LOGIC ---
  $: filteredThemes = THEMES.filter(t => t.label.toLowerCase().includes(searchQuery.toLowerCase()));
  
  // Commands List (Expandable later)
  const COMMANDS = [
      { id: 'theme', label: 'Theme...', icon: Palette, action: () => { paletteView = 'themes'; searchQuery = ''; searchInputEl?.focus(); } },
      // You can add { id: 'custom', label: 'Custom Game...', icon: Wrench, ... } here later
  ];

  $: filteredCommands = COMMANDS.filter(c => c.label.toLowerCase().includes(searchQuery.toLowerCase()));

  // --- ACTIONS ---
  function openPalette() {
      showPalette = true;
      paletteView = 'root';
      searchQuery = '';
      setTimeout(() => searchInputEl?.focus(), 50); // Focus input after render
  }

  function setMode(mode: 'time' | 'standard') { gameMode = mode; fullReset(); }
  function setSize(size: typeof GRID_SIZES[0]) { currentSize = size; fullReset(); }
  function setTime(t: number) { timeLimit = t; isCustomTime = false; fullReset(); }
  function setCustomTime() { isCustomTime = true; timeLimit = customTime; fullReset(); }

  function countCurrentSafeOpen() {
      let count = 0;
      for(let row of grid) {
          for(let cell of row) { if (cell.isOpen && !cell.isMine) count++; }
      }
      return count;
  }

  function countWrongFlags() {
      let wrong = 0;
      for(let row of grid) {
          for(let cell of row) { if (cell.isFlagged && !cell.isMine) wrong++; }
      }
      return wrong;
  }

  function calculateAccuracy() {
      if (sessionTotalMines === 0) return 0;
      const rawAcc = ((sessionTotalMines - sessionErrors) / sessionTotalMines) * 100;
      return Math.max(0, Math.round(rawAcc));
  }

  function fullReset() {
    gameState = 'pending';
    gridsSolved = 0;
    gridsPlayed = 0;
    totalCellsRevealed = 0;
    totalClicks = 0;
    sessionTotalMines = 0;
    sessionErrors = 0;
    finalAccuracy = 0;
    clickHistory = []; 
    clicksThisSecond = 0;
    timer = (gameMode === 'time') ? timeLimit : 0;
    clearInterval(timerInterval);
    resetBoard();
  }

  function resetBoard() {
    isFirstClick = true;
    grid = createGrid(currentSize.rows, currentSize.cols);
    minesLeft = currentSize.mines;
  }

  function startSession() {
    if (gameState === 'playing') return;
    gameState = 'playing';
    
    timerInterval = setInterval(() => {
        if (gameMode === 'time') { timer--; } else { timer++; }
        clickHistory.push(clicksThisSecond);
        clickHistory = clickHistory; 
        clicksThisSecond = 0; 

        if (gameMode === 'time' && timer <= 0) { finishSession(); }
    }, 1000);
  }

  function finishSession() {
    gameState = 'finished';
    clearInterval(timerInterval);
    if (clicksThisSecond > 0) clickHistory.push(clicksThisSecond);
    gridsPlayed++;
    totalCellsRevealed += countCurrentSafeOpen();
    sessionTotalMines += currentSize.mines;
    sessionErrors += countWrongFlags(); 
    finalAccuracy = calculateAccuracy();
    grid = [...grid]; 
  }

  function handleClick(r: number, c: number) {
    if (gameState === 'finished') return;
    if (grid[r][c].isFlagged) return; 

    totalClicks++;
    clicksThisSecond++;

    if (isFirstClick) {
        isFirstClick = false;
        if (gameState === 'pending') startSession();
        placeMines(grid, currentSize.mines, { r, c });
        grid = [...grid];
    }

    const result = revealCell(grid, r, c);
    grid = result.grid; 
    
    if (result.gameOver) {
        if (gameMode === 'time') {
            handleGridEnd(false);
        } else {
            sessionTotalMines += currentSize.mines;
            sessionErrors += 1; 
            sessionErrors += countWrongFlags();
            finalAccuracy = calculateAccuracy();
            finishSession();
        }
    } else {
        checkWin();
    }
  }

  function toggleFlag(r: number, c: number) {
    if (gameState === 'finished') return;
    if (!grid[r][c].isOpen) {
      grid[r][c].isFlagged = !grid[r][c].isFlagged;
      if (grid[r][c].isFlagged) minesLeft--; else minesLeft++;
      totalClicks++;
      clicksThisSecond++;
      grid = grid; 
    }
  }

  function checkWin() {
      let safeCellsOpen = 0;
      const totalSafeCells = (currentSize.rows * currentSize.cols) - currentSize.mines;
      for(let row of grid) {
          for(let cell of row) { if (cell.isOpen && !cell.isMine) safeCellsOpen++; }
      }
      if (safeCellsOpen === totalSafeCells) {
          if (gameMode === 'time') {
              handleGridEnd(true);
          } else {
              gridsSolved = 1;
              gridsPlayed = 1;
              totalCellsRevealed += totalSafeCells;
              sessionTotalMines += currentSize.mines;
              finalAccuracy = 100;
              gameState = 'finished';
              clearInterval(timerInterval);
              if (clicksThisSecond > 0) clickHistory.push(clicksThisSecond);
              grid = [...grid];
          }
      }
  }

  function handleGridEnd(win: boolean) {
      gridsPlayed++;
      sessionTotalMines += currentSize.mines;
      if (!win) sessionErrors += 1; 
      sessionErrors += countWrongFlags();
      if (win) {
          gridsSolved++;
          totalCellsRevealed += (currentSize.rows * currentSize.cols) - currentSize.mines;
      } else {
          totalCellsRevealed += countCurrentSafeOpen();
      }
      resetBoard();
  }

  function handleInput(e: KeyboardEvent) {
    if (showPalette) {
        if (e.key === 'Escape') {
            if (paletteView === 'themes') {
                paletteView = 'root';
                searchQuery = '';
            } else {
                showPalette = false;
            }
        }
        return; 
    }

    // Handle Tab Restart Logic
    if (e.key === 'Tab') {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        fullReset();
        return;
    }
    
    // Handle Esc Settings Logic
    if (e.key === 'Escape') {
        e.preventDefault();
        if (gameState === 'playing') {
             finishSession();
        } else {
             openPalette();
        }
        return;
    }

    if (e.code === 'Space') {
      e.preventDefault(); 
      if (hoveredCell) {
        const { r, c } = hoveredCell;
        const cell = grid[r][c];
        if (!cell.isOpen) toggleFlag(r, c);
        else if (cell.neighborCount > 0) attemptChord(r, c);
      }
    }
  }

  function attemptChord(r: number, c: number) {
    const cell = grid[r][c];
    let flagCount = 0;
    DIRECTIONS.forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc;
        if (grid[nr] && grid[nr][nc] && grid[nr][nc].isFlagged) flagCount++;
    });

    if (flagCount === cell.neighborCount) {
        totalClicks++; 
        clicksThisSecond++;
        DIRECTIONS.forEach(([dr, dc]) => {
            const nr = r + dr, nc = c + dc;
            if (grid[nr] && grid[nr][nc]) handleClick(nr, nc);
        });
    }
  }

  onMount(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
        currentUser = session.user.user_metadata.full_name || session.user.email?.split('@')[0];
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
            currentUser = session.user.user_metadata.full_name || session.user.email?.split('@')[0];
        } else {
            currentUser = null;
        }
    });
    fullReset();
    return () => { subscription.unsubscribe(); };
  });

  async function handleLogout() {
    await supabase.auth.signOut();
    currentUser = null;
    fullReset(); 
  }

  onDestroy(() => clearInterval(timerInterval));
</script>

<svelte:window on:keydown={handleInput} on:mouseup={() => isMouseDown = false} />

<div class="min-h-screen bg-bg text-text flex flex-col items-center font-mono relative transition-colors duration-300">
  
  <div class="w-full max-w-5xl flex justify-between items-center p-8 mb-0 animate-in fade-in slide-in-from-top-4 duration-500">
      <div class="flex items-center gap-2 select-none transition-colors duration-300 {gameState === 'playing' ? 'opacity-50 grayscale' : 'opacity-100'}">
          <Bomb size={24} class="{gameState === 'playing' ? 'text-sub' : 'text-main'}" />
          <h1 class="text-2xl font-bold tracking-tight {gameState === 'playing' ? 'text-sub' : 'text-text'}">
            zen<span class="{gameState === 'playing' ? 'text-sub' : 'text-main'}">sweep</span>
          </h1>
      </div>

      <div class="flex items-center gap-6 text-sm transition-opacity duration-300 {gameState === 'playing' ? 'opacity-0 pointer-events-none' : 'opacity-100'}">
          {#if currentUser}
              <div class="flex items-center gap-4">
                  <div class="flex items-center gap-2 text-main">
                      <User size={16} />
                      <span class="font-bold">{currentUser}</span>
                  </div>
                  <button on:click={handleLogout} class="opacity-50 hover:opacity-100 hover:text-error transition-all" title="Log Out"><LogOut size={16} /></button>
              </div>
          {:else}
              <a href="/login" class="flex items-center justify-center w-8 h-8 rounded hover:bg-sub/10 text-sub hover:text-text transition-colors"><User size={18} /></a>
          {/if}
      </div>
  </div>

  {#if gameState === 'finished'}
    
    <ResultView 
        win={true} 
        time={gameMode === 'time' ? (timeLimit - timer) : timer} 
        cells={totalCellsRevealed} 
        {totalClicks}
        history={clickHistory}
        accuracy={finalAccuracy}
        sizeLabel="{currentSize.label}"
        {gridsSolved}
        {gridsPlayed}
        mode={gameMode}
        on:restart={fullReset}
    />

  {:else}

    <div class="flex items-center gap-6 bg-sub/10 px-4 py-2 rounded-lg mb-8 text-xs select-none transition-all hover:bg-sub/15 duration-300 {gameState === 'playing' ? 'opacity-0 pointer-events-none' : 'opacity-100'}">
        <div class="flex items-center gap-3">
            <button class="flex items-center gap-2 transition-colors {gameMode === 'time' ? 'text-main font-bold' : 'text-sub hover:text-text'}" on:click={() => setMode('time')}>
                <Hourglass size={12} /><span>time</span>
            </button>
            <button class="flex items-center gap-2 transition-colors {gameMode === 'standard' ? 'text-main font-bold' : 'text-sub hover:text-text'}" on:click={() => setMode('standard')}>
                <InfinityIcon size={12} /><span>standard</span>
            </button>
        </div>
        <div class="w-[1px] h-3 bg-sub/20"></div>
        {#if gameMode === 'time'}
            <div class="flex items-center gap-3">
                <Clock size={12} class="text-sub opacity-50" />
                {#each TIME_OPTIONS as t}
                    <button class="transition-colors duration-200 {timeLimit === t && !isCustomTime ? 'text-main font-bold' : 'text-sub hover:text-text'}" on:click={() => setTime(t)}>{t}</button>
                {/each}
                <button class="transition-colors duration-200 {isCustomTime ? 'text-main' : 'text-sub hover:text-text'}" on:click={setCustomTime}><Wrench size={12} /></button>
            </div>
            <div class="w-[1px] h-3 bg-sub/20"></div>
        {/if}
        <div class="flex items-center gap-3">
            <Grid3x3 size={12} class="text-sub opacity-50" />
            {#each GRID_SIZES as size}
                <button class="transition-colors duration-200 {currentSize.label === size.label ? 'text-main font-bold' : 'text-sub hover:text-text'}" on:click={() => setSize(size)}>{size.label}</button>
            {/each}
            <button class="transition-colors duration-200 text-sub hover:text-text" on:click={openPalette}><Wrench size={12} /></button>
        </div>
    </div>

    <div class="flex flex-col gap-2 animate-in fade-in duration-300">
        <div class="flex items-end justify-between px-1 text-main select-none mb-2">
            <div class="flex flex-col w-12">
              <span class="text-[10px] text-sub uppercase font-bold opacity-50">time</span>
              <span class="text-3xl font-bold leading-none text-main">{timer}</span>
            </div>
            {#if gameMode === 'time'}
                <div class="flex flex-col items-center opacity-50">
                     <span class="text-[10px] uppercase font-bold">solved</span>
                     <span class="text-xl font-bold">{gridsSolved}/{gridsPlayed}</span>
                </div>
            {/if}
            <div class="flex flex-col w-12 text-right">
              <span class="text-[10px] text-sub uppercase font-bold opacity-50">mines</span>
              <span class="text-3xl font-bold leading-none">{minesLeft}</span>
            </div>
        </div>

        <div class="grid gap-1 bg-bg select-none transition-all duration-300 ease-in-out" style="grid-template-columns: repeat({currentSize.cols}, minmax(0, 1fr));" on:mousedown={() => { if(gameState === 'playing') isMouseDown = true }}>
          {#each grid as row, r (r)}
            {#each row as cell, c (c)}
              <button
                class="w-8 h-8 flex items-center justify-center text-sm font-bold rounded-sm transition-all duration-75 focus:outline-none
                {cell.isOpen ? 'bg-sub/10' : 'bg-sub/30 hover:bg-sub/50'}
                {cell.isMine && cell.isOpen ? 'bg-error text-bg' : ''}
                {cell.isMine && !cell.isOpen && gameState === 'finished' ? 'opacity-50 bg-error/50' : ''} 
                {hoveredCell?.r === cell.row && hoveredCell?.c === cell.col ? 'brightness-125 ring-2 ring-main/20 z-10' : ''}
                "
                on:click={() => handleClick(cell.row, cell.col)}
                on:contextmenu|preventDefault={() => toggleFlag(cell.row, cell.col)}
                on:mouseenter={() => hoveredCell = { r: cell.row, c: cell.col }}
                on:mouseleave={() => hoveredCell = null}
              >
                {#if cell.isOpen}
                  {#if cell.isMine} <Bomb size={16} /> 
                  {:else if cell.neighborCount > 0}
                    <span class={cell.neighborCount === 1 ? 'text-blue-400' : cell.neighborCount === 2 ? 'text-green-400' : cell.neighborCount === 3 ? 'text-red-400' : 'text-purple-400'}>{cell.neighborCount}</span>
                  {/if}
                {:else if cell.isFlagged}
                  <span class="text-error"><Flag size={14} fill="currentColor" /></span>
                {/if}
              </button>
            {/each}
          {/each}
        </div>
    </div>
  {/if}

{#if showPalette}
    <div 
        class="fixed inset-0 bg-black/60 flex items-start justify-center z-50 backdrop-blur-sm animate-in fade-in duration-150"
        on:mousedown|self={() => showPalette = false}
    >
        <div class="bg-bg border border-sub/20 rounded-lg shadow-2xl w-[450px] text-text font-mono mt-[15vh] overflow-hidden flex flex-col max-h-[50vh]">
            
            <div class="flex items-center gap-3 p-3 border-b border-sub/10">
                <Search size={14} class="text-main" />
                <input 
                    bind:this={searchInputEl}
                    bind:value={searchQuery}
                    type="text" 
                    placeholder={paletteView === 'root' ? "Type to search..." : "Search themes..."}
                    class="bg-transparent border-none outline-none text-xs text-text placeholder:text-sub/50 w-full h-full"
                    on:keydown={(e) => {
                        if (e.key === 'Backspace' && searchQuery === '' && paletteView === 'themes') {
                            paletteView = 'root';
                        }
                    }}
                />
                {#if paletteView === 'themes'}
                    <span class="text-[10px] bg-sub/20 px-1.5 py-0.5 rounded text-sub uppercase tracking-wider">Themes</span>
                {/if}
            </div>

            <div class="overflow-y-auto p-1.5">
                {#if paletteView === 'root'}
                    {#each filteredCommands as cmd}
                        <button 
                            class="w-full flex items-center justify-between py-1.5 px-2 rounded hover:bg-sub/10 text-left group transition-colors text-xs"
                            on:click={cmd.action}
                        >
                            <div class="flex items-center gap-3">
                                <svelte:component this={cmd.icon} size={12} class="text-sub group-hover:text-main transition-colors" />
                                <span class="group-hover:text-text text-sub/80 transition-colors">{cmd.label}</span>
                            </div>
                            <ChevronRight size={12} class="text-sub/40 group-hover:text-main transition-colors" />
                        </button>
                    {/each}
                    {#if filteredCommands.length === 0}
                         <div class="p-3 text-center text-sub opacity-50 italic text-[10px]">No commands found...</div>
                    {/if}

                {:else if paletteView === 'themes'}
                    {#each filteredThemes as theme}
                        <button 
                            class="w-full flex items-center justify-between py-1 px-2 rounded hover:bg-sub/10 text-left group transition-colors text-xs {$currentTheme.name === theme.name ? 'bg-main/5' : ''}"
                            on:click={() => { $currentTheme = theme; showPalette = false; }}
                        >
                            <div class="flex items-center gap-3">
                                <div class="flex gap-1">
                                    <div class="w-2 h-2 rounded-full border border-white/10" style="background-color: rgb({theme.colors.bg})"></div>
                                    <div class="w-2 h-2 rounded-full border border-white/10" style="background-color: rgb({theme.colors.main})"></div>
                                    <div class="w-2 h-2 rounded-full border border-white/10" style="background-color: rgb({theme.colors.error})"></div>
                                </div>
                                <span class="group-hover:text-text text-sub/80 transition-colors {$currentTheme.name === theme.name ? 'text-main font-bold' : ''}">
                                    {theme.label}
                                </span>
                            </div>
                            {#if $currentTheme.name === theme.name}
                                <span class="text-[9px] bg-main/20 text-main px-1.5 py-0 rounded">Active</span>
                            {/if}
                        </button>
                    {/each}
                    {#if filteredThemes.length === 0}
                         <div class="p-3 text-center text-sub opacity-50 italic text-[10px]">No themes found...</div>
                    {/if}
                {/if}
            </div>
            
            <div class="bg-sub/5 p-1.5 text-[10px] text-sub flex justify-between px-3 select-none border-t border-sub/10">
                <span>navigate with arrows</span>
                <div class="flex gap-3">
                     <span><kbd class="bg-sub/20 px-1 rounded">esc</kbd> close</span>
                     <span><kbd class="bg-sub/20 px-1 rounded">↵</kbd> select</span>
                </div>
            </div>

        </div>
    </div>
  {/if}

       <div class="fixed bottom-8 w-full px-8 flex justify-between text-xs text-sub opacity-40 font-mono transition-opacity duration-300 {gameState === 'playing' ? 'opacity-0' : 'opacity-100'}">
      <div class="flex gap-6">
          <div class="flex items-center gap-2">
              <kbd class="bg-sub/20 px-1.5 py-0.5 rounded text-text">tab</kbd>
              <span>- restart test</span>
          </div>
          <div class="flex items-center gap-2">
              <kbd class="bg-sub/20 px-1.5 py-0.5 rounded text-text">esc</kbd>
              <span>- settings</span>
          </div>
      </div>

      <div class="flex gap-6">
          <button 
              class="flex items-center gap-2 hover:text-text transition-colors"
              on:click={openPalette}
          >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
              <span>{$currentTheme.label}</span> 
          </button>

          <div class="flex items-center gap-2 cursor-default select-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 14V6a2 2 0 0 1 2-2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-3-3"/><path d="M14 6a2 2 0 0 0-2-2"/></svg>
              <span>v1.0.0</span>
          </div>
      </div>
  </div>

</div>
