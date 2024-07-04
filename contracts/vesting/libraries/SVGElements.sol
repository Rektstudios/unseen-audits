// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import { Math } from "@openzeppelin-4.9.6/contracts/utils/math/Math.sol";
import { Strings } from "@openzeppelin-4.9.6/contracts/utils/Strings.sol";

library SVGElements {
    using Strings for string;
    using Strings for uint256;

    string internal constant BACKGROUND =
        '<rect width="100%" height="100%" filter="url(#Noise)"/><rect x="70" y="70" width="860" height="860" fill="#fff" fill-opacity=".03" rx="45" ry="45" stroke="#fff" stroke-opacity=".1" stroke-width="4"/>';

    string internal constant BACKGROUND_COLOR = "hsl(230,21%,11%)";

    string internal constant FLOATING_TEXT =
        '<path id="FloatingText" fill="none" d="M125 45h750s80 0 80 80v750s0 80 -80 80h-750s-80 0 -80 -80v-750s0 -80 80 -80"/>';

    string internal constant LOGO =
        '<path d="M180.637,46.426V57.751a32.284,32.284,0,0,0-6.1-8.652,32.764,32.764,0,0,0-23.549-9.678,36.5,36.5,0,0,0-3.707.19l-45.607,4.663L73.267,40.4c-13.463-1.836-25.4,3.51-32.306,13.1-.063.1-.141.2-.2.3A35.921,35.921,0,0,0,34.7,73.731a42.58,42.58,0,0,0,3.046,16.136,45.286,45.286,0,0,0,1.99,4.375,46.717,46.717,0,0,0,3.01,5.022c.281.408.563.816.865,1.21a48.117,48.117,0,0,0,3.883,4.671L74.6,108.8l14.932,2.019v-.035c.324.063.655.12.985.169a13.708,13.708,0,0,0,2.321.119h.05a13.821,13.821,0,0,0,1.435-.134,11.722,11.722,0,0,0,9.657-8.222,13.282,13.282,0,0,0,.577-3.8,13.791,13.791,0,0,0-4.938-11.936l3.531-.373,30.048-3.172a31.69,31.69,0,0,1,5.838,7.153,34.057,34.057,0,0,1,4.656,17.458c0,.711-.021,1.428-.063,2.138a40.767,40.767,0,0,1-5.592,18.238c-6.457,10.67-17.282,17.824-28.965,19.139a48.088,48.088,0,0,1-11.8-.123L33.5,138.885C14.774,136.374-.25,119.134,0,100.495l1.076-78.6C1.27,8,12.791-1.678,26.809.243L155.435,17.891c13.92,1.913,25.2,14.672,25.2,28.536" transform="translate(0 0)" fill="#fff" opacity="0.4"/><path id="Path_4897" data-name="Path 4897" d="M183.595,162.276v78.49c0,13.969-11.134,26.588-24.9,28.184L30.069,283.861C15.9,285.507,4.382,275.315,4.382,261.093v-28.5c6.823,10.994,19.518,17.479,33.98,15.854l67.742-7.625,6.316-.71a39.714,39.714,0,0,0,10.8-2.806A44.378,44.378,0,0,0,143.973,219.3a45.756,45.756,0,0,0,3.616-7.758,42.829,42.829,0,0,0,2.525-14.4,37.315,37.315,0,0,0-5.149-19.237,33.857,33.857,0,0,0-2.975-4.256,34.2,34.2,0,0,0-4.424-4.488c-.1-.077-.183-.162-.289-.239L96.13,173.27a12.346,12.346,0,0,0-1.343.077,14.371,14.371,0,0,0-3.672.886,16.157,16.157,0,0,0-9.664,10.677,14.95,14.95,0,0,0-.527,3.89,12.978,12.978,0,0,0,1.554,6.26l-30.316-4.094a44.212,44.212,0,0,1-6.386-9.235,38.952,38.952,0,0,1-1.639-3.538c-.021-.443-.028-.886-.028-1.329a38.115,38.115,0,0,1,5.022-18.689c5.838-9.988,16.206-17.31,27.973-18.506l27.474-2.806,14.68-1.505,31.335-3.2c18.253-1.864,33,11.626,33,30.118" transform="translate(-2.958 -89.093)" fill="#fff" opacity="0.4"/>';

    string internal constant UNSEEN =
        '<path id="Unseen" d="M225.85,694.376a10.768,10.768,0,0,1-4.973,5.3,10.914,10.914,0,0,1-5,1.193h-21.11V690.179h15.966a4.735,4.735,0,0,0,.724-.052,5.031,5.031,0,0,0,3.7-7.373h9.218a10.684,10.684,0,0,1,2.044,4.292,11.358,11.358,0,0,1-.57,7.331" transform="translate(-131.473 -460.874)" fill="#fff" fill-opacity=".4"/><path d="M226.778,641.753v10.693H210.734a5.031,5.031,0,0,0-4.422,7.425h-9.141a10.677,10.677,0,0,1-2.044-4.293,11.362,11.362,0,0,1,.57-7.332,10.783,10.783,0,0,1,4.973-5.3,10.94,10.94,0,0,1,5-1.191Z" transform="translate(-131.473 -433.198)" fill="#fff" fill-opacity=".4"/><path d="M16.189,641.747v23.979H10.513V641.747H0v28.271a3.211,3.211,0,0,0,3.231,3.175H23.472a3.189,3.189,0,0,0,3.184-3.175V641.747Z" transform="translate(0 -433.194)" fill="#fff" fill-opacity=".4"/><path id="Path_4901" data-name="Path 4901" d="M123.966,641.75v31.444H113.452V655.732l-6.867,17.462H95.775V641.75h10.514v17.472l6.867-17.472Z" transform="translate(-64.65 -433.196)" fill="#fff" fill-opacity=".4"/><path id="Path_4902" data-name="Path 4902" d="M497.288,641.75v31.444h-10.81l-6.867-17.462v17.462H469.1V641.75H479.9l6.867,17.472V641.75Z" transform="translate(-316.652 -433.196)" fill="#fff" fill-opacity=".4"/><path id="Path_4903" data-name="Path 4903" d="M328.688,649.214v-7.467H306.656v31.447h22.032v-7.467H317.169V661.2h11.519v-7.467H317.169v-4.523Z" transform="translate(-207 -433.194)" fill="#fff" fill-opacity=".4"/><path id="Path_4904" data-name="Path 4904" d="M409.918,649.214v-7.467H387.886v31.447h22.032v-7.467H398.4V661.2h11.519v-7.467H398.4v-4.523Z" transform="translate(-261.832 -433.194)" fill="#fff" fill-opacity=".4"/>';

    string internal constant NOISE =
        '<filter id="Noise"><feFlood x="0" y="0" width="100%" height="100%" flood-color="hsl(230,21%,11%)" flood-opacity="1" result="floodFill"/><feTurbulence baseFrequency=".4" numOctaves="3" result="Noise" type="fractalNoise"/><feBlend in="Noise" in2="floodFill" mode="soft-light"/></filter>';

    /// @dev Escape character for "≥".
    string internal constant SIGN_GE = "&#8805;";

    /// @dev Escape character for ">".
    string internal constant SIGN_GT = "&gt;";

    /// @dev Escape character for "<".
    string internal constant SIGN_LT = "&lt;";

    enum CardType {
        PROGRESS,
        STATUS,
        AMOUNT,
        DURATION
    }

    function card(
        CardType cardType,
        string memory content
    ) internal pure returns (uint256, string memory) {
        return card({ cardType: cardType, content: content, circle: "" });
    }

    function card(
        CardType cardType,
        string memory content,
        string memory circle
    ) internal pure returns (uint256 width, string memory card_) {
        string memory caption = stringifyCardType(cardType);

        // The progress card can have a fixed width because the content is never longer than the caption. The former
        // has 6 characters (at most, e.g. "42.09%"), whereas the latter has 8 characters ("Progress").
        if (cardType == CardType.PROGRESS) {
            // The progress can be 0%, in which case the circle is not rendered.
            if (circle.equal("")) {
                width = 144; // 2 * 20 (margins) + 8 * 13 (charWidth)
            } else {
                width = 208; // 3 * 20 (margins) + 8 * 13 (charWidth) + 44 (diameter)
            }
        }
        // For the other cards, the width is calculated dynamically based on the number of characters.
        else {
            uint256 captionWidth = calculatePixelWidth({
                text: caption,
                largeFont: false
            });
            uint256 contentWidth = calculatePixelWidth({
                text: content,
                largeFont: true
            });

            // Use the greater of the two widths, and add the left and the right margin.
            unchecked {
                width = Math.max(captionWidth, contentWidth) + 40;
            }
        }

        card_ = string.concat(
            '<g id="',
            caption,
            '" fill="#fff">',
            '<rect width="',
            width.toString(),
            '" height="100" fill-opacity=".03" rx="15" ry="15" stroke="#fff" stroke-opacity=".1" stroke-width="4"/>',
            '<text x="20" y="34" font-family="\'Courier New\',Arial,monospace" font-size="22px">',
            caption,
            "</text>",
            '<text x="20" y="72" font-family="\'Courier New\',Arial,monospace" font-size="26px">',
            content,
            "</text>",
            circle,
            "</g>"
        );
    }

    function floatingText(
        string memory offset,
        string memory text
    ) internal pure returns (string memory) {
        return
            string.concat(
                '<textPath startOffset="',
                offset,
                '" href="#FloatingText" fill="#fff" font-family="\'Courier New\',Arial,monospace" fill-opacity=".8" font-size="26px">',
                '<animate additive="sum" attributeName="startOffset" begin="0s" dur="50s" from="0%" repeatCount="indefinite" to="100%"/>',
                text,
                "</textPath>"
            );
    }

    function identity() internal pure returns (string memory) {
        return string.concat('<g id="Logo">', LOGO, UNSEEN, "</g>");
    }

    function progressCircle(
        uint256 progressNumerical,
        string memory accentColor
    ) internal pure returns (string memory) {
        if (progressNumerical == 0) {
            return "";
        }
        return
            string.concat(
                '<g fill="none">',
                '<circle cx="166" cy="50" r="22" stroke="',
                BACKGROUND_COLOR,
                '" stroke-width="10"/>',
                '<circle cx="166" cy="50" pathLength="10000" r="22" stroke="',
                accentColor,
                '" stroke-dasharray="10000" stroke-dashoffset="',
                (10_000 - progressNumerical).toString(),
                '" stroke-linecap="round" stroke-width="5" transform="rotate(-90)" transform-origin="166 50" stroke-opacity="0.4"/>',
                "</g>"
            );
    }

    /// @notice Calculates the pixel width of the provided string.
    /// @dev Notes:
    /// - A factor of ~0.6 is applied to the two font sizes used in the SVG (26px and 22px) to approximate the average
    /// character width.
    /// - It is assumed that escaped characters are placed at the beginning of `text`.
    /// - It is further assumed that there is no other semicolon in `text`.
    function calculatePixelWidth(
        string memory text,
        bool largeFont
    ) internal pure returns (uint256 width) {
        uint256 length = bytes(text).length;
        if (length == 0) {
            return 0;
        }

        unchecked {
            uint256 charWidth = largeFont ? 16 : 13;
            uint256 semicolonIndex;
            for (uint256 i; i < length; ) {
                if (bytes(text)[i] == ";") {
                    semicolonIndex = i;
                }
                width += charWidth;
                ++i;
            }

            // Account for escaped characters (such as &#8805;).
            width -= charWidth * semicolonIndex;
        }
    }

    /// @notice Retrieves the card type as a string.
    function stringifyCardType(
        CardType cardType
    ) internal pure returns (string memory) {
        if (cardType == CardType.PROGRESS) {
            return "Progress";
        } else if (cardType == CardType.STATUS) {
            return "Status";
        } else if (cardType == CardType.AMOUNT) {
            return "Amount";
        } else {
            return "Duration";
        }
    }
}
