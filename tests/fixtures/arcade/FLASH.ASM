; FLASH.COM: the arcade spec's DOS program (131 bytes, public domain: see LICENCE). It counts its visits in its own
; save file (SAVE.DAT, one byte), then fills the 320x200 screen with a new colour every vertical retrace, starting
; sixteen colours further on for each visit, until ESC. The spec checks that frames change, that the save is kept
; when the player quits, and that it is read back after a reload (the count goes 1, then 2).
; Assembled by hand (each instruction's bytes on its right); any 8086 assembler gives the same bytes from this.
        org 100h
start:  mov ax,0013h        ; B8 13 00      320x200, 256 colours
        int 10h             ; CD 10
        mov ax,3D00h        ; B8 00 3D      open SAVE.DAT to read
        mov dx,fname        ; BA 79 01
        int 21h             ; CD 21
        jc nofile           ; 72 10
        mov bx,ax           ; 89 C3
        mov ah,3Fh          ; B4 3F         read its one byte into count
        mov cx,1            ; B9 01 00
        mov dx,count        ; BA 82 01
        int 21h             ; CD 21
        mov ah,3Eh          ; B4 3E         close
        int 21h             ; CD 21
nofile: inc byte [count]    ; FE 06 82 01   one more visit
        mov ah,3Ch          ; B4 3C         create SAVE.DAT
        xor cx,cx           ; 31 C9
        mov dx,fname        ; BA 79 01
        int 21h             ; CD 21
        jc skip             ; 72 10
        mov bx,ax           ; 89 C3
        mov ah,40h          ; B4 40         write count
        mov cx,1            ; B9 01 00
        mov dx,count        ; BA 82 01
        int 21h             ; CD 21
        mov ah,3Eh          ; B4 3E         close
        int 21h             ; CD 21
skip:   mov ax,0A000h       ; B8 00 A0
        mov es,ax           ; 8E C0
        mov bl,[count]      ; 8A 1E 82 01
        mov cl,4            ; B1 04
        shl bl,cl           ; D2 E3         each visit starts sixteen colours on
frame:  mov dx,3DAh         ; BA DA 03      wait for the vertical retrace
w1:     in al,dx            ; EC
        test al,8           ; A8 08
        jnz w1              ; 75 FB
w2:     in al,dx            ; EC
        test al,8           ; A8 08
        jz w2               ; 74 FB
        xor di,di           ; 31 FF
        mov al,bl           ; 88 D8
        mov ah,al           ; 88 C4
        mov cx,32000        ; B9 00 7D
        rep stosw           ; F3 AB         the whole screen in this frame's colour
        inc bl              ; FE C3
        mov ah,1            ; B4 01         a key waiting?
        int 16h             ; CD 16
        jz frame            ; 74 E0
        mov ah,0            ; B4 00
        int 16h             ; CD 16
        cmp al,27           ; 3C 1B         ESC ends it
        jne frame           ; 75 D8
        mov ax,0003h        ; B8 03 00
        int 10h             ; CD 10
        ret                 ; C3
fname:  db 'SAVE.DAT',0
count:  db 0
