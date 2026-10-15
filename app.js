(() => {
  'use strict';

  const FILES = 'abcdefgh';
  const HUMAN_COLOR = 'green';
  const COLOR_NAMES = { red: 'RED', green: 'GREEN' };
  const PLAYER_NAMES = { red: 'Cpt_Knockturn', green: 'Neo_Coder' };
  const PIECE_NAMES = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };
  const PIECE_GLYPHS = {
    red: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
    green: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' },
  };

  const boardElement = document.getElementById('chessboard');
  const moveLogElement = document.getElementById('moveLog');
  const toastElement = document.getElementById('toast');
  const compileButton = document.getElementById('compileButton');
  const boardSquares = new Map();

  let toastTimer = null;
  let computerTimer = null;
  let game = createGame();

  function createPosition() {
    const position = {};
    const backRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];

    // Red's pieces anchor the near side of the board; Green's pieces hold the far side.
    backRank.forEach((type, fileIndex) => {
      position[squareName(fileIndex, 1)] = { type, color: 'red', moved: false };
      position[squareName(fileIndex, 8)] = { type, color: 'green', moved: false };
    });
    for (let fileIndex = 0; fileIndex < 8; fileIndex += 1) {
      position[squareName(fileIndex, 2)] = { type: 'P', color: 'red', moved: false };
      if (fileIndex !== 4) {
        position[squareName(fileIndex, 7)] = { type: 'P', color: 'green', moved: false };
      }
    }

    // Snapshot the story's current position: Green has advanced e5, then Red's
    // knight probe landed on d3. The opening moves before this scene are omitted.
    delete position.g1;
    position.e5 = { type: 'P', color: 'green', moved: true };
    position.d3 = { type: 'N', color: 'red', moved: true };
    return position;
  }

  function createGame() {
    return {
      position: createPosition(),
      turn: 'green',
      status: 'active',
      result: null,
      clocks: { red: 8 * 60 + 32, green: 7 * 60 + 45 },
      selected: null,
      hintActive: true,
      lastMove: null,
      lastMoves: [
        { color: 'green', to: 'e5' },
        { color: 'red', to: 'd3' },
      ],
      history: [
        { color: 'green', notation: 'e5', note: "KING'S PAWN · CENTER CONTROL" },
        { color: 'red', notation: 'Nd3', note: 'KNIGHT PROBE · FIREWALL TEST' },
      ],
      integrity: 81,
      thinking: false,
      commandMessage: 'Your move. The firewall is holding.',
      selectionMessage: 'Select a green packet on the board, or compile the suggested defense.',
    };
  }

  function squareName(fileIndex, rank) {
    return `${FILES[fileIndex]}${rank}`;
  }

  function coordinates(square) {
    return { file: FILES.indexOf(square[0]), rank: Number(square[1]) };
  }

  function insideBoard(file, rank) {
    return file >= 0 && file < 8 && rank >= 1 && rank <= 8;
  }

  function otherColor(color) {
    return color === 'red' ? 'green' : 'red';
  }

  function buildBoard() {
    for (let rank = 8; rank >= 1; rank -= 1) {
      for (let file = 0; file < 8; file += 1) {
        const square = squareName(file, rank);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `square ${(file + rank) % 2 === 0 ? 'light' : 'dark'}`;
        button.dataset.square = square;
        button.setAttribute('aria-label', `Square ${square}`);

        if (file === 0) {
          const rankCoordinate = document.createElement('span');
          rankCoordinate.className = 'coord rank';
          rankCoordinate.setAttribute('aria-hidden', 'true');
          rankCoordinate.textContent = String(rank);
          button.append(rankCoordinate);
        }
        if (rank === 1) {
          const fileCoordinate = document.createElement('span');
          fileCoordinate.className = 'coord file';
          fileCoordinate.setAttribute('aria-hidden', 'true');
          fileCoordinate.textContent = FILES[file];
          button.append(fileCoordinate);
        }

        boardSquares.set(square, button);
        boardElement.append(button);
      }
    }
  }

  function clearChildren(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  function renderBoard() {
    const selectedMoves = game.selected ? getLegalMoves(game.position, game.selected, game.lastMove) : [];
    const legalTargets = new Set(selectedMoves.map((move) => move.to));
    const suggestedMove = game.status === 'active' && game.turn === HUMAN_COLOR ? getSuggestedMove() : null;

    for (const [square, button] of boardSquares) {
      const piece = game.position[square];
      const existingCoordinateNodes = Array.from(button.querySelectorAll('.coord'));
      clearChildren(button);
      existingCoordinateNodes.forEach((node) => button.append(node));

      button.classList.remove('selected', 'legal-target', 'legal-capture', 'last-green', 'last-red', 'hint-source', 'hint-target');
      button.removeAttribute('aria-pressed');
      button.tabIndex = 0;

      const lastMoveAtSquare = [...game.lastMoves].reverse().find((move) => move.to === square);
      if (lastMoveAtSquare) button.classList.add(lastMoveAtSquare.color === 'green' ? 'last-green' : 'last-red');
      if (game.selected === square) {
        button.classList.add('selected');
        button.setAttribute('aria-pressed', 'true');
      }
      if (legalTargets.has(square)) {
        button.classList.add('legal-target');
        if (piece && piece.color !== HUMAN_COLOR) button.classList.add('legal-capture');
      }
      if (game.hintActive && suggestedMove) {
        if (suggestedMove.from === square) button.classList.add('hint-source');
        if (suggestedMove.to === square) button.classList.add('hint-target');
      }

      if (piece) {
        const token = document.createElement('span');
        token.className = `piece ${piece.color}${piece.type === 'P' ? ' pawn' : ''}`;
        token.setAttribute('aria-hidden', 'true');
        token.textContent = PIECE_GLYPHS[piece.color][piece.type];
        button.append(token);
        button.setAttribute('aria-label', `${square}, ${COLOR_NAMES[piece.color].toLowerCase()} ${PIECE_NAMES[piece.type]}${lastMoveAtSquare ? ', last move destination' : ''}`);
      } else {
        button.setAttribute('aria-label', `Square ${square}${lastMoveAtSquare ? ', last move destination' : ''}`);
      }
    }
  }

  function renderPlayers() {
    const redCard = document.getElementById('redCard');
    const greenCard = document.getElementById('greenCard');
    const redClock = document.getElementById('redClock');
    const greenClock = document.getElementById('greenClock');
    const redState = document.getElementById('redState');
    const greenState = document.getElementById('greenState');

    redClock.textContent = formatClock(game.clocks.red);
    greenClock.textContent = formatClock(game.clocks.green);
    redClock.classList.toggle('low-time', game.clocks.red <= 60);
    greenClock.classList.toggle('low-time', game.clocks.green <= 60);

    const redKnights = Object.values(game.position).filter((piece) => piece.color === 'red' && piece.type === 'N').length;
    const greenKnights = Object.values(game.position).filter((piece) => piece.color === 'green' && piece.type === 'N').length;
    document.getElementById('redKnights').textContent = String(redKnights).padStart(2, '0');
    document.getElementById('greenKnights').textContent = String(greenKnights).padStart(2, '0');
    document.getElementById('moveCount').textContent = `${String(game.history.length).padStart(2, '0')} MOVES`;

    redCard.classList.toggle('active-turn', game.status === 'active' && game.turn === 'red');
    greenCard.classList.toggle('active-turn', game.status === 'active' && game.turn === 'green');

    if (game.result) {
      redState.textContent = resultLabel('red');
      greenState.textContent = resultLabel('green');
    } else {
      redState.textContent = game.turn === 'red' ? (game.thinking ? 'COMPILING' : 'COUNTERTRACE') : 'STANDBY';
      greenState.textContent = game.turn === 'green' ? 'YOUR TURN' : 'ROUTE HELD';
    }
  }

  function renderLog() {
    clearChildren(moveLogElement);
    const recent = game.history.slice(-6);
    recent.forEach((entry, index) => {
      const sequence = game.history.length - recent.length + index + 1;
      const item = document.createElement('li');
      item.className = `move-entry ${entry.color}`;

      const dot = document.createElement('span');
      dot.className = 'entry-dot';
      dot.setAttribute('aria-hidden', 'true');

      const main = document.createElement('div');
      main.className = 'entry-main';
      const heading = document.createElement('div');
      heading.className = 'entry-heading';
      const team = document.createElement('span');
      team.className = 'entry-team';
      team.textContent = COLOR_NAMES[entry.color];
      const player = document.createElement('span');
      player.className = 'entry-name';
      player.textContent = PLAYER_NAMES[entry.color];
      heading.append(team, player);
      const note = document.createElement('span');
      note.className = 'entry-note';
      note.textContent = entry.note;
      main.append(heading, note);

      const notation = document.createElement('span');
      notation.className = 'entry-notation';
      notation.textContent = entry.notation;
      const seq = document.createElement('span');
      seq.className = 'entry-seq';
      seq.textContent = String(sequence).padStart(2, '0');
      item.append(dot, main, notation, seq);
      moveLogElement.append(item);
    });
  }

  function renderTelemetry() {
    const integrity = Math.max(0, Math.min(100, game.integrity));
    document.getElementById('integrityValue').textContent = `${integrity}%`;
    document.getElementById('integrityBar').style.width = `${integrity}%`;
    const keyStatus = document.getElementById('keyStatus');
    const bandwidth = document.querySelector('.key-foot b');

    if (!game.result) {
      keyStatus.textContent = 'LOCKED';
      bandwidth.textContent = 'CONTESTED';
      keyStatus.style.color = '';
    } else if (game.result.winner === 'green') {
      keyStatus.textContent = 'KEY SECURED';
      bandwidth.textContent = 'NEO CLAIMED';
      keyStatus.style.color = 'var(--green)';
    } else if (game.result.winner === 'red') {
      keyStatus.textContent = 'ROOT BREACHED';
      bandwidth.textContent = 'RED CLAIMED';
      keyStatus.style.color = 'var(--red)';
    } else {
      keyStatus.textContent = 'UNRESOLVED';
      bandwidth.textContent = 'CONTESTED';
      keyStatus.style.color = 'var(--amber)';
    }

    const status = document.getElementById('sessionStatus');
    status.textContent = game.result ? (game.result.winner === 'draw' ? 'DEADLOCK' : 'ENDED') : 'ACTIVE';
    status.style.color = game.result ? 'var(--amber)' : '';
  }

  function renderControls() {
    boardElement.setAttribute('aria-label', game.result
      ? `Chess board. Session ended: ${game.result.reason.toLowerCase()}.`
      : `Chess board. ${COLOR_NAMES[game.turn]} to move.`);
    const turnBadge = document.getElementById('turnBadge');
    const turnText = document.getElementById('turnText');
    const commandStatus = document.getElementById('commandStatus');
    const selectionHint = document.getElementById('selectionHint');
    const compileLabel = document.getElementById('compileLabel');
    const scanTitle = document.getElementById('scanTitle');
    const scanCopy = document.getElementById('scanCopy');
    const suggestedMoveElement = document.getElementById('suggestedMove');

    turnBadge.classList.remove('red-turn', 'game-over');
    if (game.result) {
      turnBadge.classList.add('game-over');
      turnText.textContent = game.result.winner === 'draw'
        ? 'POSITION LOCKED · DRAW'
        : `${COLOR_NAMES[game.result.winner]} ${game.result.reason}`;
      commandStatus.textContent = game.result.winner === 'green'
        ? 'Key secured. Red has been disconnected.'
        : game.result.winner === 'red'
          ? 'Firewall breached. Neo_Coder has been disconnected.'
          : 'No route survives. The session is locked.';
      selectionHint.textContent = 'Reboot the session to run the puzzle again.';
      compileLabel.textContent = 'SESSION ENDED';
      compileButton.disabled = true;
      scanTitle.textContent = game.result.winner === 'green' ? 'Bandwidth acquired.' : 'Protocol terminated.';
      scanCopy.textContent = game.result.winner === 'draw' ? 'The board reached a deadlock.' : `${PLAYER_NAMES[game.result.winner]} wins the bandwidth claim.`;
      suggestedMoveElement.textContent = '—';
      return;
    }

    if (game.turn === 'red') {
      turnBadge.classList.add('red-turn');
      turnText.textContent = game.thinking ? 'RED COMPILING RESPONSE' : 'RED COUNTERTRACE';
      commandStatus.textContent = game.thinking ? 'Cpt_Knockturn is probing the new route…' : 'Red is executing a countertrace.';
      selectionHint.textContent = 'Countertrace in progress. Green input will reopen after the handshake.';
      compileLabel.textContent = game.thinking ? 'COMPILING' : 'RED IS ANALYZING';
      compileButton.disabled = true;
      scanTitle.textContent = game.thinking ? 'Opponent response detected.' : 'Handshake in transit.';
      scanCopy.textContent = 'Cpt_Knockturn is testing the firewall for an open route.';
      suggestedMoveElement.textContent = '…';
      return;
    }

    turnText.textContent = 'GREEN RESPONSE WINDOW';
    commandStatus.textContent = game.commandMessage;
    selectionHint.textContent = game.selectionMessage;
    compileLabel.textContent = 'COMPILE DEFENSE';
    compileButton.disabled = false;
    const suggestion = getSuggestedMove();
    suggestedMoveElement.textContent = suggestion ? formatNotation(suggestion, game.position) : '—';
    scanTitle.textContent = game.selected ? 'Route locked. Awaiting input.' : 'Defense route compiled.';
    scanCopy.textContent = game.selected
      ? `Choose one of the highlighted squares to route your ${PIECE_NAMES[game.position[game.selected].type]}.`
      : suggestion
        ? 'A central knight route is ready. Choose your move or send the suggested response.'
        : 'Select a green packet to inspect available routes.';
  }

  function render() {
    renderBoard();
    renderPlayers();
    renderLog();
    renderTelemetry();
    renderControls();
  }

  function formatClock(seconds) {
    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
    const remainder = (safeSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${remainder}`;
  }

  function resultLabel(color) {
    if (game.result.winner === 'draw') return 'DRAW';
    if (game.result.winner === color) return 'BANDWIDTH WON';
    return 'DISCONNECTED';
  }

  function getPseudoLegalMoves(position, from, lastMove) {
    const piece = position[from];
    if (!piece) return [];
    const { file, rank } = coordinates(from);
    const moves = [];
    const pushIfOpen = (targetFile, targetRank) => {
      if (!insideBoard(targetFile, targetRank)) return;
      const to = squareName(targetFile, targetRank);
      const target = position[to];
      if (!target) {
        moves.push({ from, to });
      } else if (target.color !== piece.color && target.type !== 'K') {
        moves.push({ from, to });
      }
    };

    if (piece.type === 'P') {
      const direction = piece.color === 'green' ? -1 : 1;
      const oneRank = rank + direction;
      if (insideBoard(file, oneRank) && !position[squareName(file, oneRank)]) {
        moves.push({ from, to: squareName(file, oneRank) });
        const startRank = piece.color === 'green' ? 7 : 2;
        const twoRank = rank + direction * 2;
        if (rank === startRank && !position[squareName(file, twoRank)]) {
          moves.push({ from, to: squareName(file, twoRank), pawnDouble: true });
        }
      }
      for (const deltaFile of [-1, 1]) {
        const targetFile = file + deltaFile;
        const targetRank = rank + direction;
        if (!insideBoard(targetFile, targetRank)) continue;
        const to = squareName(targetFile, targetRank);
        const target = position[to];
        if (target && target.color !== piece.color && target.type !== 'K') {
          moves.push({ from, to });
        }
      }

      if (lastMove && lastMove.pieceType === 'P' && lastMove.color !== piece.color && Math.abs(lastMove.fromRank - lastMove.toRank) === 2) {
        const lastTo = coordinates(lastMove.to);
        if (lastTo.rank === rank && Math.abs(lastTo.file - file) === 1) {
          const to = squareName(lastTo.file, rank + direction);
          if (!position[to]) moves.push({ from, to, enPassantCapture: lastMove.to });
        }
      }
      return moves;
    }

    if (piece.type === 'N') {
      const offsets = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
      offsets.forEach(([dx, dy]) => pushIfOpen(file + dx, rank + dy));
      return moves;
    }

    if (piece.type === 'K') {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          if (dx !== 0 || dy !== 0) pushIfOpen(file + dx, rank + dy);
        }
      }
      moves.push(...getCastlingMoves(position, from, piece));
      return moves;
    }

    const directions = [];
    if (piece.type === 'B' || piece.type === 'Q') directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
    if (piece.type === 'R' || piece.type === 'Q') directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    for (const [dx, dy] of directions) {
      let targetFile = file + dx;
      let targetRank = rank + dy;
      while (insideBoard(targetFile, targetRank)) {
        const to = squareName(targetFile, targetRank);
        const target = position[to];
        if (!target) {
          moves.push({ from, to });
        } else {
          if (target.color !== piece.color && target.type !== 'K') moves.push({ from, to });
          break;
        }
        targetFile += dx;
        targetRank += dy;
      }
    }
    return moves;
  }

  function getCastlingMoves(position, from, king) {
    const { file, rank } = coordinates(from);
    const homeRank = king.color === 'red' ? 1 : 8;
    if (king.moved || file !== 4 || rank !== homeRank || isSquareAttacked(position, from, otherColor(king.color))) return [];
    const moves = [];

    const sides = [
      { rookFile: 7, emptyFiles: [5, 6], crossingFiles: [5, 6], toFile: 6, castle: 'king' },
      { rookFile: 0, emptyFiles: [1, 2, 3], crossingFiles: [3, 2], toFile: 2, castle: 'queen' },
    ];
    sides.forEach((side) => {
      const rook = position[squareName(side.rookFile, homeRank)];
      if (!rook || rook.type !== 'R' || rook.color !== king.color || rook.moved) return;
      if (side.emptyFiles.some((fileIndex) => position[squareName(fileIndex, homeRank)])) return;
      if (side.crossingFiles.some((fileIndex) => isSquareAttacked(position, squareName(fileIndex, homeRank), otherColor(king.color)))) return;
      moves.push({ from, to: squareName(side.toFile, homeRank), castle: side.castle });
    });
    return moves;
  }

  function applyMove(position, move) {
    const next = { ...position };
    const moving = next[move.from];
    if (!moving) return next;
    delete next[move.from];
    if (move.enPassantCapture) delete next[move.enPassantCapture];

    if (move.castle) {
      const rank = coordinates(move.from).rank;
      const isKingSide = move.castle === 'king';
      const rookFrom = squareName(isKingSide ? 7 : 0, rank);
      const rookTo = squareName(isKingSide ? 5 : 3, rank);
      if (next[rookFrom]) {
        next[rookTo] = { ...next[rookFrom], moved: true };
        delete next[rookFrom];
      }
    }

    let movedPiece = { ...moving, moved: true };
    const destination = coordinates(move.to);
    if (movedPiece.type === 'P' && (destination.rank === 1 || destination.rank === 8)) {
      movedPiece = { ...movedPiece, type: 'Q' };
    }
    next[move.to] = movedPiece;
    return next;
  }

  function getLegalMoves(position, from, lastMove) {
    const piece = position[from];
    if (!piece) return [];
    return getPseudoLegalMoves(position, from, lastMove).filter((move) => {
      const simulated = applyMove(position, move);
      return !isInCheck(simulated, piece.color);
    });
  }

  function allLegalMoves(position, color, lastMove) {
    const moves = [];
    for (const [from, piece] of Object.entries(position)) {
      if (piece.color !== color) continue;
      getLegalMoves(position, from, lastMove).forEach((move) => moves.push(move));
    }
    return moves;
  }

  function isInCheck(position, color) {
    const kingSquare = Object.keys(position).find((square) => position[square].color === color && position[square].type === 'K');
    return kingSquare ? isSquareAttacked(position, kingSquare, otherColor(color)) : false;
  }

  function isSquareAttacked(position, targetSquare, byColor) {
    const target = coordinates(targetSquare);
    for (const [from, piece] of Object.entries(position)) {
      if (piece.color !== byColor) continue;
      const start = coordinates(from);
      const dx = target.file - start.file;
      const dy = target.rank - start.rank;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (piece.type === 'P') {
        const direction = piece.color === 'green' ? -1 : 1;
        if (dy === direction && absX === 1) return true;
      } else if (piece.type === 'N') {
        if ((absX === 1 && absY === 2) || (absX === 2 && absY === 1)) return true;
      } else if (piece.type === 'K') {
        if (Math.max(absX, absY) === 1) return true;
      } else {
        const diagonal = absX === absY && absX > 0;
        const straight = (dx === 0) !== (dy === 0);
        const canSlide = piece.type === 'Q' || (piece.type === 'B' && diagonal) || (piece.type === 'R' && straight);
        if (!canSlide || (!diagonal && !straight)) continue;
        const stepX = Math.sign(dx);
        const stepY = Math.sign(dy);
        let file = start.file + stepX;
        let rank = start.rank + stepY;
        let blocked = false;
        while (file !== target.file || rank !== target.rank) {
          if (position[squareName(file, rank)]) {
            blocked = true;
            break;
          }
          file += stepX;
          rank += stepY;
        }
        if (!blocked) return true;
      }
    }
    return false;
  }

  function getSuggestedMove() {
    if (game.status !== 'active' || game.turn !== HUMAN_COLOR) return null;
    const moves = allLegalMoves(game.position, HUMAN_COLOR, game.lastMove);
    if (!moves.length) return null;

    // The Matrix protocol's first compiled answer is a knight development to f6.
    const knightRoute = moves.find((move) => move.from === 'g8' && move.to === 'f6');
    if (knightRoute) return knightRoute;

    return moves.sort((a, b) => scoreGreenMove(b) - scoreGreenMove(a))[0];
  }

  function scoreGreenMove(move) {
    const piece = game.position[move.from];
    const capture = move.enPassantCapture ? game.position[move.enPassantCapture] : game.position[move.to];
    let score = capture ? 100 : 0;
    if (piece.type === 'N') score += 12;
    const to = coordinates(move.to);
    score += 4 - (Math.abs(to.file - 3.5) + Math.abs(to.rank - 4.5)) * 0.45;
    if (move.to === 'e4' || move.to === 'd4') score += 2;
    return score;
  }

  function scoreRedMove(move) {
    const piece = game.position[move.from];
    const capture = move.enPassantCapture ? game.position[move.enPassantCapture] : game.position[move.to];
    const value = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
    let score = capture ? 15 + value[capture.type] * 4 : 0;
    const nextPosition = applyMove(game.position, move);
    if (isInCheck(nextPosition, 'green')) score += 14;
    const target = coordinates(move.to);
    score += 3.5 - (Math.abs(target.file - 3.5) + Math.abs(target.rank - 4.5)) * 0.34;
    if (piece.type === 'N' && ['e5', 'f4', 'c5', 'e3', 'f2'].includes(move.to)) score += 3;
    if (piece.type === 'P' && ['d4', 'e4', 'f4'].includes(move.to)) score += 1.5;
    if (piece.type === 'K') score -= 3;
    return score;
  }

  function formatNotation(move, position) {
    if (!move) return '—';
    if (move.castle === 'king') return 'O-O';
    if (move.castle === 'queen') return 'O-O-O';
    const piece = position[move.from];
    if (!piece) return move.to;
    const capture = Boolean(position[move.to] || move.enPassantCapture);
    const prefix = piece.type === 'P' ? (capture ? move.from[0] : '') : piece.type;
    const suffix = capture ? 'x' : '';
    const promotion = piece.type === 'P' && (move.to[1] === '1' || move.to[1] === '8') ? '=Q' : '';
    return `${prefix}${suffix}${move.to}${promotion}`;
  }

  function handleSquareClick(square) {
    if (game.status !== 'active' || game.turn !== HUMAN_COLOR || game.thinking) return;
    game.hintActive = false;
    const clickedPiece = game.position[square];

    if (game.selected) {
      const selectedMove = getLegalMoves(game.position, game.selected, game.lastMove).find((move) => move.to === square);
      if (selectedMove) {
        performMove(selectedMove, HUMAN_COLOR);
        return;
      }
    }

    if (clickedPiece && clickedPiece.color === HUMAN_COLOR) {
      game.selected = square;
      const available = getLegalMoves(game.position, square, game.lastMove).length;
      game.commandMessage = `${PIECE_NAMES[clickedPiece.type]} ${square.toUpperCase()} selected.`;
      game.selectionMessage = available
        ? `${available} legal route${available === 1 ? '' : 's'} highlighted. Choose a destination.`
        : 'This packet has no legal route. Select another piece.';
      render();
      return;
    }

    game.selected = null;
    game.commandMessage = 'No route selected. The defense window is open.';
    game.selectionMessage = 'Select a green packet on the board, or compile the suggested defense.';
    render();
  }

  function performMove(move, color) {
    const movingPiece = game.position[move.from];
    if (!movingPiece || movingPiece.color !== color) return;
    const capture = move.enPassantCapture ? game.position[move.enPassantCapture] : game.position[move.to];
    const notation = formatNotation(move, game.position);
    const nextPosition = applyMove(game.position, move);
    const nextColor = otherColor(color);
    const nextLastMove = {
      from: move.from,
      to: move.to,
      color,
      pieceType: movingPiece.type,
      fromRank: coordinates(move.from).rank,
      toRank: coordinates(move.to).rank,
    };

    game.position = nextPosition;
    game.lastMove = nextLastMove;
    game.lastMoves.push({ color, from: move.from, to: move.to });
    game.lastMoves = game.lastMoves.slice(-2);
    game.selected = null;
    game.hintActive = false;
    game.history.push({
      color,
      notation,
      note: capture ? `PACKET CAPTURED · ${PIECE_NAMES[capture.type].toUpperCase()} LOST` : color === 'green' ? 'DEFENSE ROUTED · HANDSHAKE ACCEPTED' : 'COUNTERTRACE · FIREWALL TEST',
    });
    game.turn = nextColor;
    game.thinking = nextColor === 'red';
    game.integrity = Math.max(8, Math.min(100, game.integrity + (color === 'green' ? 2 : -4) - (capture && capture.color === 'green' ? 5 : 0)));
    game.commandMessage = color === 'green' ? `Defense sent: ${notation}. Awaiting countertrace.` : 'Your move. The firewall is holding.';
    game.selectionMessage = color === 'green' ? 'Red is testing your new route.' : 'Select a green packet on the board, or compile the suggested defense.';

    const replies = allLegalMoves(game.position, nextColor, game.lastMove);
    if (replies.length === 0) {
      game.status = 'ended';
      game.thinking = false;
      game.result = isInCheck(game.position, nextColor)
        ? { winner: color, reason: 'CHECKMATE' }
        : { winner: 'draw', reason: 'STALEMATE' };
      if (isInCheck(game.position, nextColor) && game.history.length > 0) {
        game.history[game.history.length - 1].notation += '#';
      }
      render();
      showToast(game.result.winner === 'draw' ? 'POSITION LOCKED // STALEMATE' : `${COLOR_NAMES[color]} WINS // ${game.result.reason}`);
      return;
    }

    const inCheck = isInCheck(game.position, nextColor);
    if (inCheck && game.history.length > 0) game.history[game.history.length - 1].notation += '+';
    render();

    if (nextColor === 'red') scheduleComputerMove();
  }

  function scheduleComputerMove() {
    window.clearTimeout(computerTimer);
    game.thinking = true;
    render();
    computerTimer = window.setTimeout(() => {
      if (game.status !== 'active' || game.turn !== 'red') return;
      const moves = allLegalMoves(game.position, 'red', game.lastMove);
      if (!moves.length) {
        finishNoMoves('red');
        return;
      }
      const bestScore = Math.max(...moves.map(scoreRedMove));
      const candidates = moves.filter((move) => scoreRedMove(move) >= bestScore - 0.3);
      const choice = candidates[Math.floor(Math.random() * candidates.length)];
      game.thinking = false;
      performMove(choice, 'red');
      if (game.status === 'active') {
        game.commandMessage = 'Countertrace intercepted. Green response window reopened.';
        game.selectionMessage = 'Select a green packet on the board, or compile the suggested defense.';
        game.hintActive = true;
        render();
      }
    }, 820);
  }

  function finishNoMoves(color) {
    game.thinking = false;
    game.status = 'ended';
    game.result = isInCheck(game.position, color)
      ? { winner: otherColor(color), reason: 'CHECKMATE' }
      : { winner: 'draw', reason: 'STALEMATE' };
    render();
    showToast(game.result.winner === 'draw' ? 'POSITION LOCKED // STALEMATE' : `${COLOR_NAMES[game.result.winner]} WINS // CHECKMATE`);
  }

  function executeDefense() {
    if (game.status !== 'active') return;
    if (game.turn !== HUMAN_COLOR || game.thinking) {
      showToast('RED COUNTERTRACE IN PROGRESS // HOLD POSITION', true);
      return;
    }
    const move = getSuggestedMove();
    if (!move) {
      finishNoMoves(HUMAN_COLOR);
      return;
    }
    const notation = formatNotation(move, game.position);
    game.hintActive = false;
    game.commandMessage = `Compiled route sent: ${notation}.`;
    game.selectionMessage = 'Handshake sent. Red is building a countertrace.';
    showToast(`DEFENSE COMPILED // ${notation}`);
    performMove(move, HUMAN_COLOR);
  }

  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    toastElement.textContent = message;
    toastElement.classList.toggle('error', isError);
    toastElement.classList.add('visible');
    toastTimer = window.setTimeout(() => toastElement.classList.remove('visible'), 2300);
  }

  function resetGame() {
    window.clearTimeout(computerTimer);
    window.clearTimeout(toastTimer);
    toastElement.classList.remove('visible', 'error');
    game = createGame();
    render();
    showToast('SESSION REBOOTED // GREEN RESPONSE WINDOW OPEN');
  }

  function tickClock() {
    if (game.status !== 'active' || !game.turn) return;
    game.clocks[game.turn] = Math.max(0, game.clocks[game.turn] - 1);
    if (game.clocks[game.turn] === 0) {
      const loser = game.turn;
      game.status = 'ended';
      game.result = { winner: otherColor(loser), reason: 'TIMEOUT' };
      game.thinking = false;
      window.clearTimeout(computerTimer);
      showToast(`${COLOR_NAMES[otherColor(loser)]} WINS // TIMEOUT`);
    }
    if (game.result) {
      render();
    } else {
      renderPlayers();
      renderTelemetry();
    }
  }

  boardElement.addEventListener('click', (event) => {
    const squareButton = event.target.closest('[data-square]');
    if (squareButton) handleSquareClick(squareButton.dataset.square);
  });

  compileButton.addEventListener('click', executeDefense);
  document.getElementById('resetButton').addEventListener('click', resetGame);
  document.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' || event.repeat) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.closest('#resetButton'))) return;
    event.preventDefault();
    executeDefense();
  });

  buildBoard();
  render();
  window.setInterval(tickClock, 1000);
})();
