//export function rocksGameInit() {     // ES6 modules don't work without web server (CORS limitations)
window.rocksGameInit = function() {
    let body = document.getElementsByTagName("body")[0];

    let gameHeight = 700;
    let gameWidth = gameHeight * body.clientWidth / body.clientHeight;

    let canvas = document.getElementById("myCanvas")

    let scalingFactor = Math.min(body.clientHeight/gameHeight, body.clientWidth/gameWidth);
    canvas.height = gameHeight * scalingFactor;
    canvas.width = gameWidth * scalingFactor;

    let maxRocks = gameHeight * gameWidth / 4500;
    
    let constants = {
        asteroidSpeed: 0.08,
        projectileSpeed: 0.16,
        maxRocks: maxRocks,
        maxViewRotateSpeed: 0.001,
        maxViewRotatation: 0.25,
        shipX: gameWidth / 2,
        shipY: gameHeight - 70,
        width: gameWidth,
        height: gameHeight,
        scalingFactor: scalingFactor
    };

    
    let ctx = canvas.getContext("2d")
    ctx.scale(constants.scalingFactor, constants.scalingFactor);

    let gameState = {};
    resetGameState();

    function resetGameState() {
        gameState = {
            weaponReloading: false,
            rocks: [],
            projectiles: [],
            viewRotateSpeed: 0,
            viewRotation: 0,
            shoot: null,
            maxRocks: constants.width * constants.height / 20000,
            on: false,
            startDt: new Date(),
            timeStamp: null,
            gameLoopInterval: setInterval(gameLoopFn, 20),
            endDt: null
        };
        introRocks();
    }

    function getTimeFormatted() {
        let dateDiff = (gameState.endDt || new Date()) - gameState.startDt;
        let minutes = Math.floor(dateDiff / 1000 / 60);
        let seconds = Math.floor(dateDiff / 1000 % 60);
        let ms = (minutes+"").padStart(2, '0') + ":" + (seconds+"").padStart(2, '0');
        return ms;
    }

    function translateX(x, y, angle) {
        return x * Math.cos(angle) - y * Math.sin(angle)
    }

    function translateY(x, y, angle) {
        return x * Math.sin(angle) + y * Math.cos(angle)
    }

    function calculateXY(originX, originY, x, y, angle) {
        newX = originX + translateX(x, y, angle)
        newY = originY + translateY(x, y, angle)

        return {
            x: translateX(newX, newY, angle),
            y: translateY(newX, newY, angle),
        }
    }

    function lineToWithRotation(ctx, ox, oy, x, y, angle) {
        let xy = calculateXY(ox, oy, x, y, angle);
        ctx.lineTo(xy.x, xy.y);
    }

    function drawRock(rock) {
        ctx.beginPath();

        for (let i = 0; i < 2 * Math.PI; i += rock.shape) {
            let x = Math.sin(i) * rock.size
            let y = Math.cos(i) * rock.size

            let xy = calculateXY(rock.x, rock.y, x, y, gameState.viewRotation)
            ctx.lineTo(xy.x, xy.y)
        }

        ctx.closePath();
        ctx.strokeStyle = 'rgba(0, 0, 0, ' + rock.opacity + ')';
        ctx.stroke();
    }

    function drawProjectile(projectile) {
        ctx.beginPath()
        ctx.arc(projectile.x, projectile.y, 5, 0, Math.PI * 2)
        ctx.stroke()
    }

    function drawShip(x, y) {
        ctx.beginPath();
        lineToWithRotation(ctx, x, y, 0, 0, gameState.viewRotation*0.04);
        lineToWithRotation(ctx, x, y, -20, 30, gameState.viewRotation*0.04);
        lineToWithRotation(ctx, x, y, +20, 30, gameState.viewRotation*0.04);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
    }

    function generateRocks() {
        for (let n = 0; n < gameState.maxRocks - gameState.rocks.length; n++) {
            let size = 11 + Math.random() * 17;
            let x = (Math.random() * constants.width * 2.8) - constants.width * 1.4;
            let y = -(size * 4 + Math.random() * constants.height) - constants.height/2;

            gameState.rocks.push({
                x: x,
                y: y,
                angle: Math.random() * 10,
                size: size,
                shape: 1 + Math.random() * 0.35,
                goodbye: false,
                opacity: 1
            });
        }
    }

    function introRocks() {
        let titleAscii = `
            **  *** ***   *  * *** 
            * * * * *     * *  *   
            **  * * *     **   *** 
            * * * * *     * *    * 
            * * *** ***   *  * *** 
        `.split("\n").map(x => x.trim());

        let maxY = titleAscii.length;
        let maxX = titleAscii.reduce((m,x) => x.length > m ? x.length : m, 0) + 1;
        let charY = constants.height / maxY / 2.2;
        let charX = constants.width / maxX;

        let minChar = Math.min(charX, charY);

        for(let i = 0; i<titleAscii.length; i++) {
            for(let j = 0; j<titleAscii[i].length; j++) {
                if (titleAscii[i][j] != ' ') {
                    gameState.rocks.push({
                        y: minChar+(i-1)*charY,
                        x: minChar+j*charX,
                        angle: 10,
                        size: minChar/2.2 + Math.random()*minChar/10,
                        shape: 1,
                        goodbye: false,
                        opacity: 1
                    });
                }
            }
        }
    }

    function getNormalizedVector(projectile) {
        let vecX = projectile.toX - projectile.fromX;
        let vecY = Math.abs(projectile.toY - projectile.fromY);
        let vecLength = Math.sqrt(vecX * vecX + vecY * vecY);

        return {
            x: vecX / vecLength,
            y: vecY / vecLength
        };
    }

    canvas.addEventListener('mousedown', ev => {
        if (gameState.weaponReloading)
            return;

        if (gameState.endDt) {
            resetGameState();
            return;
        }

        gameState.on = true;

        // https://stackoverflow.com/questions/17130395/real-mouse-position-in-canvas
        let rect = canvas.getBoundingClientRect();
        gameState.shoot = {
            x: (ev.clientX - rect.left) * 1/constants.scalingFactor,
            y: (ev.clientY - rect.top) * 1/constants.scalingFactor
        };

        gameState.weaponReloading = true;

        setTimeout(() => gameState.weaponReloading = false, 500);
    }, false);

    function gameLoopFn() {
        let timeDiff = gameState.on && gameState.timeStamp ? Date.now() - gameState.timeStamp : 0;
        gameState.timeStamp = Date.now();

        gameState.maxRocks += (constants.width * constants.height / (10 * 10000000)) * timeDiff;
        

        if (gameState.shoot) {
            let projectile = {
                fromX: constants.shipX,
                fromY: constants.shipY,
                x: constants.shipX,
                y: constants.shipY,
                toX: gameState.shoot.x,
                toY: gameState.shoot.y,
            };
            gameState.projectiles.push(projectile);

            let normalizedVector = getNormalizedVector(projectile);
            gameState.viewRotateSpeed -= normalizedVector.x/100000*timeDiff;
            
            gameState.shoot = null;
        }

        gameState.viewRotation += gameState.viewRotateSpeed * timeDiff;

        if (Math.abs(gameState.viewRotateSpeed) > constants.maxViewRotateSpeed) {
            gameState.viewRotateSpeed = Math.sign(gameState.viewRotateSpeed) * constants.maxViewRotateSpeed;
        }

        if (Math.abs(gameState.viewRotation) > constants.maxViewRotatation) {
            gameState.viewRotation = Math.sign(gameState.viewRotation) * constants.maxViewRotatation;

            gameState.viewRotateSpeed = -Math.sign(gameState.viewRotateSpeed) *
                Math.max(
                    constants.maxViewRotateSpeed * 0.11,
                    Math.min(Math.abs(gameState.viewRotateSpeed), constants.maxViewRotateSpeed * 0.33)
                );
        }

        generateRocks();

        for (let ixRock in gameState.rocks) {
            let rock = gameState.rocks[ixRock];
            if (!rock) {
                continue;
            }

            let xy = calculateXY(rock.x, rock.y, 0, 0, gameState.viewRotation);

            if (rock.goodbye) {
                rock.size -= rock.size * timeDiff/100;
                rock.opacity = Math.max(0, rock.opacity - timeDiff/200);

                if (rock.opacity < 0.1) {
                    gameState.rocks[ixRock] = null;
                }
            } else if (Math.abs(xy.x - constants.shipX) < (20 + rock.size / 4)
                && Math.abs(xy.y - constants.shipY) < (10 + rock.size / 4)) {
                
                gameState.endDt = new Date();
                clearInterval(gameState.gameLoopInterval);
                break;

            }

            //rock.angle += gameState.viewRotateSpeed * timeDiff;
            rock.y += constants.asteroidSpeed * timeDiff;
        }

        for (let ixProjectile in gameState.projectiles) {
            let projectile = gameState.projectiles[ixProjectile];
            if (!projectile) {
                continue;
            }

            let normalizedVector = getNormalizedVector(projectile);
            projectile.x += normalizedVector.x * constants.projectileSpeed * timeDiff
            projectile.y -= normalizedVector.y * constants.projectileSpeed * timeDiff

            for (let ixRock in gameState.rocks) {
                let rock = gameState.rocks[ixRock];
                if (!rock) {
                    continue;
                }

                let rockXy = calculateXY(rock.x, rock.y, 0, 0, gameState.viewRotation);

                // if there is a collision between projectile and a rock, we must destroy both
                if (Math.abs(rockXy.x - projectile.x) < rock.size
                    && Math.abs(rockXy.y - projectile.y) < rock.size) {
                        //gameState.rocks[ixRock] = null;
                    gameState.rocks[ixRock].goodbye = true;
                    gameState.projectiles[ixProjectile] = null;
                }
            }
        }

        // cleanup function - actually deletes rocks and projectiles
        gameState.rocks = gameState.rocks.filter(r => {
            if (!r) {
                return false;
            }

            let rockXy = calculateXY(r.x, r.y, 0, 0, gameState.viewRotation);

            return rockXy.y < constants.height + r.size * 4;
        });
        gameState.projectiles = gameState.projectiles.filter(p => p);

        window.requestAnimationFrame(() => {
            ctx.clearRect(0, 0, constants.width, constants.height);

            if (gameState.viewRotation > 0.9 * constants.maxViewRotatation) {
                ctx.rect(constants.width - 10, 0, constants.width, constants.height);
            } else if (gameState.viewRotation < -0.9 * constants.maxViewRotatation) {
                ctx.rect(0, 0, 10, constants.height);
            }

            ctx.fill();

            for (let projectile of gameState.projectiles) {
                drawProjectile(projectile);
            }

            for (let rock of gameState.rocks) {
                drawRock(rock);
            }

            if (!gameState.on) {
                ctx.font = "24px Georgia";
                ctx.textAlign = "center";
                ctx.fillText("Steer by shooting.", constants.width/2, constants.height/2);
                ctx.fillText("Shoot to start (click).", constants.width/2, constants.height/2 + 40);
            }
            
            if (gameState.endDt) {
                ctx.font = "24px Georgia";
                ctx.textAlign = "center";
                ctx.rect(0, 0, constants.width, constants.height);
                ctx.fillStyle = "rgba(255,255,255,0.8)";
                ctx.fill();
                ctx.fillStyle = "rgba(0,0,0,1)";
                ctx.fillText(getTimeFormatted(), constants.width/2, constants.height/2);
                ctx.fillText("Click to play again...", constants.width/2, constants.height/2 + 40);
            }

            drawShip(constants.shipX, constants.shipY, 0);
        });
    }
};