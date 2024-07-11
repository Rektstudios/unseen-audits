// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { SVGElements } from "./SVGElements.sol";

library NFTSVG {
    using Strings for uint256;

    uint256 internal constant CARD_MARGIN = 16;

    struct SVGParams {
        string accentColor;
        string amount;
        string uncnAddress;
        string uncnSymbol;
        string duration;
        string progress;
        uint256 progressNumerical;
        string unseenVestingAddress;
        string status;
        string vestingModel;
    }

    struct SVGVars {
        string amountCard;
        uint256 amountWidth;
        uint256 amountXPosition;
        string cards;
        uint256 cardsWidth;
        string durationCard;
        uint256 durationWidth;
        uint256 durationXPosition;
        string progressCard;
        uint256 progressWidth;
        uint256 progressXPosition;
        string statusCard;
        uint256 statusWidth;
        uint256 statusXPosition;
    }

    function generateSVG(
        SVGParams memory params
    ) internal pure returns (string memory) {
        SVGVars memory vars;

        // Generate the progress card.
        (vars.progressWidth, vars.progressCard) = SVGElements.card({
            cardType: SVGElements.CardType.PROGRESS,
            content: params.progress,
            circle: SVGElements.progressCircle({
                progressNumerical: params.progressNumerical,
                accentColor: params.accentColor
            })
        });

        // Generate the status card.
        (vars.statusWidth, vars.statusCard) = SVGElements.card({
            cardType: SVGElements.CardType.STATUS,
            content: params.status
        });

        // Generate the deposit amount card.
        (vars.amountWidth, vars.amountCard) = SVGElements.card({
            cardType: SVGElements.CardType.AMOUNT,
            content: params.amount
        });

        // Generate the duration card.
        (vars.durationWidth, vars.durationCard) = SVGElements.card({
            cardType: SVGElements.CardType.DURATION,
            content: params.duration
        });

        unchecked {
            // Calculate the width of the row containing the cards and the margins between them.
            vars.cardsWidth =
                vars.amountWidth +
                vars.durationWidth +
                vars.progressWidth +
                vars.statusWidth +
                CARD_MARGIN *
                3;

            // Calculate the positions on the X axis based on the following layout:
            //
            // ___________________________ SVG Width (1000px) ___________________________
            // |     |          |      |        |      |        |      |          |     |
            // | <-> | Progress | 16px | Status | 16px | Amount | 16px | Duration | <-> |
            vars.progressXPosition = (1000 - vars.cardsWidth) / 2;
            vars.statusXPosition =
                vars.progressXPosition +
                vars.progressWidth +
                CARD_MARGIN;
            vars.amountXPosition =
                vars.statusXPosition +
                vars.statusWidth +
                CARD_MARGIN;
            vars.durationXPosition =
                vars.amountXPosition +
                vars.amountWidth +
                CARD_MARGIN;
        }

        // Concatenate all cards.
        vars.cards = string.concat(
            vars.progressCard,
            vars.statusCard,
            vars.amountCard,
            vars.durationCard
        );

        return
            string.concat(
                '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">',
                SVGElements.BACKGROUND,
                generateDefs(vars.cards),
                generateFloatingText(
                    params.unseenVestingAddress,
                    params.vestingModel,
                    params.uncnAddress,
                    params.uncnSymbol
                ),
                generateHrefs(
                    vars.progressXPosition,
                    vars.statusXPosition,
                    vars.amountXPosition,
                    vars.durationXPosition
                ),
                "</svg>"
            );
    }

    function generateDefs(
        string memory cards
    ) internal pure returns (string memory) {
        return
            string.concat(
                "<defs>",
                SVGElements.NOISE,
                SVGElements.LOGO,
                SVGElements.FLOATING_TEXT,
                SVGElements.identity(),
                cards,
                "</defs>"
            );
    }

    function generateFloatingText(
        string memory unseenVestingAddress,
        string memory vestingModel,
        string memory uncnAddress,
        string memory uncnSymbol
    ) internal pure returns (string memory) {
        return
            string.concat(
                '<text text-rendering="optimizeSpeed">',
                SVGElements.floatingText({
                    offset: "-100%",
                    text: string.concat(
                        unseenVestingAddress,
                        unicode" • ",
                        "Unseen Vesting ",
                        vestingModel
                    )
                }),
                SVGElements.floatingText({
                    offset: "0%",
                    text: string.concat(
                        unseenVestingAddress,
                        unicode" • ",
                        "Unseen Vesting ",
                        vestingModel
                    )
                }),
                SVGElements.floatingText({
                    offset: "-50%",
                    text: string.concat(uncnAddress, unicode" • ", uncnSymbol)
                }),
                SVGElements.floatingText({
                    offset: "50%",
                    text: string.concat(uncnAddress, unicode" • ", uncnSymbol)
                }),
                "</text>"
            );
    }

    function generateHrefs(
        uint256 progressXPosition,
        uint256 statusXPosition,
        uint256 amountXPosition,
        uint256 durationXPosition
    ) internal pure returns (string memory) {
        return
            string.concat(
                '<use href="#Logo" x="110" y="50" transform="scale(2.5)" />'
                '<use href="#Progress" x="',
                progressXPosition.toString(),
                '" y="790"/>',
                '<use href="#Status" x="',
                statusXPosition.toString(),
                '" y="790"/>',
                '<use href="#Amount" x="',
                amountXPosition.toString(),
                '" y="790"/>',
                '<use href="#Duration" x="',
                durationXPosition.toString(),
                '" y="790"/>'
            );
    }
}
