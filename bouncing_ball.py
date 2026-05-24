import pygame
import sys

WIDTH, HEIGHT = 800, 600
BALL_RADIUS = 30
BALL_COLOR = (220, 50, 50)
BG_COLOR = (15, 15, 25)
FPS = 60

def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Bouncing Ball")
    clock = pygame.time.Clock()

    x = WIDTH // 2
    y = HEIGHT // 2
    vx = 5
    vy = 4

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE:
                pygame.quit()
                sys.exit()

        x += vx
        y += vy

        if x - BALL_RADIUS <= 0:
            x = BALL_RADIUS
            vx = abs(vx)
        elif x + BALL_RADIUS >= WIDTH:
            x = WIDTH - BALL_RADIUS
            vx = -abs(vx)

        if y - BALL_RADIUS <= 0:
            y = BALL_RADIUS
            vy = abs(vy)
        elif y + BALL_RADIUS >= HEIGHT:
            y = HEIGHT - BALL_RADIUS
            vy = -abs(vy)

        screen.fill(BG_COLOR)

        pygame.draw.circle(screen, (180, 30, 30), (x, y), BALL_RADIUS)
        pygame.draw.circle(screen, BALL_COLOR, (x - 6, y - 6), BALL_RADIUS // 4)

        pygame.display.flip()
        clock.tick(FPS)

if __name__ == "__main__":
    main()
