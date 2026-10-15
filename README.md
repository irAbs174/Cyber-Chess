# Cyber-Chess — The Last Key

A small, self-contained browser prototype for the Camplate chess match in 2088. The opening position reflects the latest feed: Neo_Coder's `e5`, followed by Cpt_Knockturn's `Nd3`.

## Run locally

No install or build step is required. Serve this directory with any static web server, for example:

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Play

- Move Green (Neo_Coder) by selecting a piece, then a highlighted destination.
- Or press **Space** / **COMPILE DEFENSE** to send the suggested move.
- Red (Cpt_Knockturn) replies automatically. Both clocks run during the active turn.
- **Reboot Session** resets the clocks and board.

The local prototype validates standard piece movement, check, checkmate, castling, en passant, and automatic queen promotion. It has no network or multiplayer connection.
