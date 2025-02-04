import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { Component, OnInit } from '@angular/core';
import { GaemService } from 'src/app/services/gaem/gaem.service';
import { Card, CardMeta } from 'src/app/models/card';
import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { Subscription, timer } from 'rxjs';
import { Router } from '@angular/router';
import { ScoreService } from 'src/app/services/score/score.service';

@Component({
  selector: 'app-gaem',
  templateUrl: './gaem.component.html',
  styleUrls: ['./gaem.component.css'],
  animations: [
    trigger('addedRemoved', [
      state(
        'added',
        style({
          opacity: '100%',
          position: 'relative',
          top: '0rem',
        })
      ),
      state(
        'removed',
        style({ opacity: '0%', position: 'relative', top: '3rem' })
      ),
      // NOTE: do not change these without also changing the timeouts
      transition('added => removed', [animate('1s')]),
      transition('removed => added', [animate('0.5s')]),
    ]),
  ],
})
export class GaemComponent implements OnInit {
  public deckCards: Card[] = [];
  public fightingZones: Card[][] = [[], []];
  public roundNum: number = 1;
  public secondsElapsed: number = 90;
  public roundTimes: number[] = [];
  public timer = timer(1000, 1000);
  public coinsEarned: number = 100;
  public waitingForResp = false;

  public enemyCards: Card[] = [];
  public enemyFightingZones: Card[][] = [[], []];

  private subscription?: Subscription;
  showWinModal = false;
  showLoseModal = false;

  constructor(
    private service: GaemService,
    private router: Router,
    private scorer: ScoreService
  ) {
    this.service.onReset(() => {
      this.reset();
    });

    const someCardMeta: CardMeta = {
      imgUrl: '/assets/images/card-example.svg',
      damage: 100,
      maxHealth: 500,
    };
    this.enemyCards = [
      new Card(someCardMeta),
      new Card(someCardMeta),
      new Card(someCardMeta),
      new Card(someCardMeta),
      new Card(someCardMeta),
      new Card(someCardMeta),
      new Card(someCardMeta),
      new Card(someCardMeta),
    ];
    for (let i = 0; i < this.enemyCards.length; ++i) {
      this.enemyCards[i].takeDamage((i + 1) * 60);
    }
  }

  reset() {
    this.deckCards = [];
    this.addToDeck(this.service.serveHand(4));
    this.fightingZones = [[], []];
    this.roundNum = 1;

    this.resetTimer();

    this.roundTimes = [];

    this.showLoseModal = false;
    this.showWinModal = false;
  }

  stopTimer() {
    if (this.subscription !== undefined) {
      this.subscription.unsubscribe();
    }
  }

  resetTimer() {
    this.stopTimer();

    this.timer = timer(1000, 1000);
    this.secondsElapsed = 30;
    this.subscription = this.timer.subscribe((val) => {
      this.secondsElapsed = 30 - (val + 1);

      if (this.secondsElapsed <= 0) {
        this.secondsElapsed = 0;

        this.showLoseModal = true;
      }
    });
  }

  addToDeck(newCards: Card[]) {
    this.deckCards = this.deckCards.concat(newCards);

    setTimeout(() => {
      this.deckCards.forEach((card) => {
        card.added = true;
      });
    }, 500);
  }

  ngOnInit(): void {
    this.reset();
  }

  dropCard(event: CdkDragDrop<Card[]>, targetNumber: number = 0) {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    } else if (targetNumber > 0) {
      if (event.container.data.length == 0) {
        transferArrayItem(
          event.previousContainer.data,
          event.container.data,
          event.previousIndex,
          event.currentIndex
        );
        // event.container.element.nativeElement.classList.remove('h-48');
        // event.container.element.nativeElement.classList.remove('w-32');
      }
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
      // event.previousContainer.element.nativeElement.classList.add('h-48');
      // event.previousContainer.element.nativeElement.classList.add('w-32');
    }
  }

  canBeDroppedToFight(drag: CdkDrag, drop: CdkDropList) {
    return drop.data.length === 0;
  }

  canBeDroppedToDeck(drag: CdkDrag, drop: CdkDropList) {
    return true;
  }

  hasEmptyFightingZones(): boolean {
    const numFightingZones = this.fightingZones.length;
    const filledFightingZones = this.numCardsInFightingZones();

    return numFightingZones !== filledFightingZones;
  }

  numCardsInFightingZones(): number {
    return this.fightingZones
      .filter((zone) => zone.length > 0)
      .filter((zone) => zone[0].isAlive() && zone[0].added).length;
  }

  availableSpaceInDeck(): number {
    return 4 - this.deckCards.length;
  }

  addEnemyCards() {
    for (let fightingZone of this.enemyFightingZones) {
      if (fightingZone.length == 0) {
        const newCard = this.enemyCards.shift();
        if (newCard !== undefined) {
          fightingZone.push(newCard);

          console.log('Added enemy card', newCard);

          setTimeout(() => {
            newCard.added = true;
          }, 500);
        }
      }
    }
  }

  checkPlayerWin() {
    if (
      this.enemyCards.length == 0 &&
      this.enemyFightingZones.filter((zone) => zone.length > 0).length == 0
    ) {
      console.log('Win!');
      this.showWinModal = true;
    }
  }

  continue() {
    if (this.waitingForResp) {
      return;
    }

    let message = 'Next round started';
    let toContinue = true;

    if (this.hasEmptyFightingZones() && this.deckCards.length > 0) {
      message =
        'There are empty fighting zones and you have cards left on your deck!';
      toContinue = false;
    }

    if (this.numCardsInFightingZones() === 0) {
      message = 'No cards in fighting zone!';
      toContinue = false;
    }

    console.log(this.fightingZones);
    console.log(toContinue, message);

    if (toContinue) {
      this.waitingForResp = true;
      this.stopTimer();
      this.roundTimes.push(this.secondsElapsed);

      setTimeout(() => {
        this.waitingForResp = false;

        // TODO: remove this sim
        this.addEnemyCards();

        setTimeout(() => {
          const enemyDamages = this.enemyFightingZones.map(
            (zone) => zone[0]?.meta.damage
          );
          this.takeDamages(this.fightingZones, enemyDamages);
          const playerDamages = this.fightingZones.map(
            (zone) => zone[0]?.meta.damage
          );
          this.takeDamages(this.enemyFightingZones, playerDamages);
          this.roundCompleted();

          this.resetTimer();
          this.roundNum += 1;

          if (this.noCardsLeft()) {
            this.showLoseModal = true;
          }
        }, 700);
      }, 2000);
    }
  }

  takeDamages(zones: Card[][], damages: number[]) {
    zones.forEach((cards, index) => {
      if (cards.length > 0) {
        const damage = damages.shift();
        if (damage !== undefined) {
          const alive = cards[0].takeDamage(damage);
          if (!alive) {
            this.cardDied(zones, index);
          }
        }
      }
    });
  }

  roundCompleted() {
    this.coinsEarned = this.scorer.getScore(
      this.deckCards.concat(this.fightingZones.map((zone) => zone[0])),
      this.roundTimes
    );
    this.checkPlayerWin();

    this.addToDeck(
      this.service.serveHand(
        this.availableSpaceInDeck() - this.numCardsInFightingZones()
      )
    );
  }

  noCardsLeft(): boolean {
    return (
      this.availableSpaceInDeck() == 4 && this.numCardsInFightingZones() == 0
    );
  }

  cardDied(zones: Card[][], zoneIndex: number) {
    console.log(`Killing card with index ${zoneIndex}`);
    const removedCard = zones[zoneIndex][0];
    if (removedCard !== undefined) {
      removedCard.added = false;
    }

    setTimeout(() => {
      zones[zoneIndex].shift();
    }, 1000);
  }

  playAgain() {
    this.router.navigateByUrl('/');
  }
}
