
import {
  LitElement,
  html,
  css,
} from "https://unpkg.com/lit@3/index.js?module";


class WindCompassCard extends LitElement {

  static get properties() {
    return {
      hass: {},
      config: {},
    };
  }


  setConfig(config) {

    if (
      !config.wind_speed_entity ||
      !config.wind_dir_entity
    ) {
      throw new Error(
        "You must define 'wind_speed_entity' and 'wind_dir_entity'"
      );
    }

    this.config = {
      title: "Wind",

      show_header: true,

      show_header_icon: false,

      header_icon: "mdi:weather-windy",

      show_gusts: true,

      show_direction: true,

      show_direction_name: true,

      arrow_direction: "from",

      compass_size: 250,

      max_wind_speed: 30,

      data_position: "below",

      ...config,
    };
  }


  getCardSize() {
    return 6;
  }


  /* ================================= */
  /* HELPERS */
  /* ================================= */

  _normalizeDegrees(value) {

    let degrees = Number(value);

    if (!Number.isFinite(degrees)) {
      return 0;
    }

    degrees = degrees % 360;

    if (degrees < 0) {
      degrees += 360;
    }

    return degrees;
  }


  _getCompassDirection(degrees) {

    const directions = [
      "N",
      "NNE",
      "NE",
      "ENE",
      "E",
      "ESE",
      "SE",
      "SSE",
      "S",
      "SSW",
      "SW",
      "WSW",
      "W",
      "WNW",
      "NW",
      "NNW",
    ];

    return directions[
      Math.round(degrees / 22.5) % 16
    ];
  }


  _formatNumber(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
      return "0";
    }

    if (Number.isInteger(number)) {
      return String(number);
    }

    return number.toFixed(1);
  }


  _getWindScale(speed) {

    const configuredMax =
      Number(this.config.max_wind_speed) || 30;

    const numericSpeed =
      Number(speed) || 0;

    if (numericSpeed <= configuredMax) {
      return configuredMax;
    }

    if (numericSpeed <= 40) {
      return 40;
    }

    if (numericSpeed <= 50) {
      return 50;
    }

    if (numericSpeed <= 60) {
      return 60;
    }

    if (numericSpeed <= 80) {
      return 80;
    }

    return Math.ceil(
      numericSpeed / 20
    ) * 20;
  }


  _polarToCartesian(
    centerX,
    centerY,
    radius,
    angleInDegrees
  ) {

    const angleInRadians =
      (angleInDegrees - 90) *
      Math.PI /
      180;

    return {
      x:
        centerX +
        radius *
        Math.cos(angleInRadians),

      y:
        centerY +
        radius *
        Math.sin(angleInRadians),
    };
  }


  _describeArc(
    cx,
    cy,
    radius,
    startAngle,
    endAngle
  ) {

    const start =
      this._polarToCartesian(
        cx,
        cy,
        radius,
        endAngle
      );

    const end =
      this._polarToCartesian(
        cx,
        cy,
        radius,
        startAngle
      );

    const largeArcFlag =
      endAngle - startAngle <= 180
        ? "0"
        : "1";

    return [
      "M",
      start.x,
      start.y,
      "A",
      radius,
      radius,
      0,
      largeArcFlag,
      0,
      end.x,
      end.y,
    ].join(" ");
  }


  /* ================================= */
  /* COMPASS TICKS */
  /* ================================= */

  _renderTicks() {

    const ticks = [];

    for (let i = 0; i < 72; i++) {

      const angle = i * 5;

      const major =
        i % 6 === 0;

      const medium =
        i % 3 === 0;

      ticks.push(
        html`
          <line
            x1="50"
            y1="${
              major
                ? 5
                : medium
                  ? 6.5
                  : 7.5
            }"
            x2="50"
            y2="${
              major
                ? 9
                : medium
                  ? 9.5
                  : 10
            }"
            class="
              tick
              ${major ? "major" : ""}
              ${medium ? "medium" : ""}
            "
            transform="
              rotate(
                ${angle}
                50
                50
              )
            "
          ></line>
        `
      );
    }

    return ticks;
  }


  /* ================================= */
  /* ACTIONS */
  /* ================================= */

  _fireHassAction(actionType) {

    if (
      !actionType ||
      actionType === "none"
    ) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent(
        "hass-action",
        {
          bubbles: true,
          composed: true,
          detail: {
            config: this.config,
            action: actionType,
          },
        }
      )
    );
  }


  _handleTap() {

    const action =
      this.config.tap_action?.action ||
      "none";

    this._fireHassAction(action);
  }


  _handleHold() {

    const action =
      this.config.hold_action?.action ||
      "none";

    this._fireHassAction(action);
  }


  _handleDoubleTap() {

    const action =
      this.config.double_tap_action?.action ||
      "none";

    this._fireHassAction(action);
  }


  _pointerDown() {

    this._holdTriggered = false;

    clearTimeout(
      this._holdTimer
    );

    this._holdTimer =
      setTimeout(() => {

        this._holdTriggered = true;

        this._handleHold();

      }, 500);
  }


  _pointerUp() {

    clearTimeout(
      this._holdTimer
    );

    if (this._holdTriggered) {
      return;
    }

    const now = Date.now();

    if (
      this._lastTap &&
      now - this._lastTap < 350
    ) {

      clearTimeout(
        this._tapTimer
      );

      this._lastTap = 0;

      this._handleDoubleTap();

      return;
    }

    this._lastTap = now;

    this._tapTimer =
      setTimeout(() => {

        this._handleTap();

        this._lastTap = 0;

      }, 350);
  }


  _pointerCancel() {

    clearTimeout(
      this._holdTimer
    );
  }


  /* ================================= */
  /* RENDER */
  /* ================================= */

  render() {

    if (
      !this.hass ||
      !this.config
    ) {
      return html``;
    }


    const speedState =
      this.hass.states[
        this.config.wind_speed_entity
      ];


    const gustState =
      this.config.wind_gust_entity
        ? this.hass.states[
            this.config.wind_gust_entity
          ]
        : null;


    const directionState =
      this.hass.states[
        this.config.wind_dir_entity
      ];


    const speed =
      speedState
        ? this._formatNumber(
            speedState.state
          )
        : "0";


    const numericSpeed =
      Number(speed) || 0;


    const speedUnit =
      speedState
        ?.attributes
        ?.unit_of_measurement ||
      "";


    const gust =
      gustState
        ? this._formatNumber(
            gustState.state
          )
        : null;


    const gustUnit =
      gustState
        ?.attributes
        ?.unit_of_measurement ||
      speedUnit;


    const direction =
      this._normalizeDegrees(
        directionState
          ? directionState.state
          : 0
      );


    const compassDirection =
      this._getCompassDirection(
        direction
      );


    /*
     * Arrow direction
     *
     * FROM:
     *   Arrow points toward the direction
     *   the wind is coming FROM.
     *
     * TO:
     *   Arrow points toward the direction
     *   the wind is traveling TO.
     */

    const arrowRotation =
      this.config.arrow_direction === "to"
        ? this._normalizeDegrees(
            direction + 180
          )
        : direction;


    const scale =
      this._getWindScale(
        numericSpeed
      );


    const speedPercent =
      Math.min(
        100,
        Math.max(
          0,
          numericSpeed /
            scale *
            100
        )
      );


    const arcStart = -135;

    const arcEnd = 135;

    const currentArcEnd =
      arcStart +
      (
        (arcEnd - arcStart) *
        speedPercent /
        100
      );


    const backgroundArc =
      this._describeArc(
        50,
        50,
        46,
        arcStart,
        arcEnd
      );


    const activeArc =
      this._describeArc(
        50,
        50,
        46,
        arcStart,
        currentArcEnd
      );


    const arcStartPoint =
      this._polarToCartesian(
        50,
        50,
        46,
        arcStart
      );


    const arcEndPoint =
      this._polarToCartesian(
        50,
        50,
        46,
        arcEnd
      );


    const compassSize =
      Number(
        this.config.compass_size
      ) || 250;


    const dataPosition =
      this.config.data_position ||
      "below";


    return html`

      <ha-card
        class="
          wind-card
          position-${dataPosition}
        "

        @pointerdown="${this._pointerDown}"

        @pointerup="${this._pointerUp}"

        @pointercancel="${this._pointerCancel}"

        @pointerleave="${this._pointerCancel}"
      >


        <!-- ======================== -->
        <!-- HEADER -->
        <!-- ======================== -->

        ${
          this.config.show_header !== false
            ? html`

                <div class="header">

                  ${
                    this.config.show_header_icon === true
                      ? html`
                          <ha-icon
                            class="header-icon"
                            .icon="${
                              this.config.header_icon ||
                              "mdi:weather-windy"
                            }"
                          ></ha-icon>
                        `
                      : ""
                  }


                  <div class="title">

                    ${
                      this.config.title ||
                      "Wind"
                    }

                  </div>

                </div>

              `
            : ""
        }


        <!-- ======================== -->
        <!-- CONTENT -->
        <!-- ======================== -->

        <div class="content">


          <!-- ======================== -->
          <!-- COMPASS -->
          <!-- ======================== -->

          <div
            class="wind-dial"
            style="
              --compass-size:
              ${compassSize}px;
            "
          >

            <div class="dial-glow"></div>


            <svg
              class="compass"
              viewBox="0 0 100 100"
            >


              <!-- WIND ARC -->

              <path
                d="${backgroundArc}"
                class="wind-arc-background"
              ></path>


              ${
                speedPercent > 0
                  ? html`
                      <path
                        d="${activeArc}"
                        class="wind-arc"
                      ></path>
                    `
                  : ""
              }


              <circle
                cx="${arcStartPoint.x}"
                cy="${arcStartPoint.y}"
                r="1.15"
                class="arc-dot"
              ></circle>


              <circle
                cx="${arcEndPoint.x}"
                cy="${arcEndPoint.y}"
                r="1.15"
                class="arc-dot"
              ></circle>


              <!-- COMPASS TICKS -->

              ${this._renderTicks()}


              <!-- CARDINAL DIRECTIONS -->

              <text
                x="50"
                y="17"
                class="
                  direction-label
                  cardinal
                "
              >
                N
              </text>


              <text
                x="83"
                y="54"
                class="
                  direction-label
                  cardinal
                "
              >
                E
              </text>


              <text
                x="50"
                y="87"
                class="
                  direction-label
                  cardinal
                "
              >
                S
              </text>


              <text
                x="17"
                y="54"
                class="
                  direction-label
                  cardinal
                "
              >
                W
              </text>


              <!-- SECONDARY DIRECTIONS -->

              <text
                x="73"
                y="26"
                class="
                  direction-label
                  secondary
                "
              >
                NE
              </text>


              <text
                x="74"
                y="82"
                class="
                  direction-label
                  secondary
                "
              >
                SE
              </text>


              <text
                x="27"
                y="82"
                class="
                  direction-label
                  secondary
                "
              >
                SW
              </text>


              <text
                x="26"
                y="26"
                class="
                  direction-label
                  secondary
                "
              >
                NW
              </text>


              <!-- ======================== -->
              <!-- WIND ARROW -->
              <!-- ======================== -->

              <g
                class="wind-arrow"
                style="
                  transform:
                    rotate(
                      ${arrowRotation}deg
                    );
                "
              >

                <path
                  d="
                    M 50 9

                    C 48.9 13.4
                      47.8 18.0
                      46.7 22.5

                    C 45.5 27.3
                      44.5 32.0
                      43.8 36.2

                    C 43.5 37.9
                      44.1 39.0
                      45.3 39.6

                    C 46.4 40.2
                      47.5 39.6
                      48.2 38.4

                    L 50 34.8

                    L 51.8 38.4

                    C 52.5 39.6
                      53.6 40.2
                      54.7 39.6

                    C 55.9 39.0
                      56.5 37.9
                      56.2 36.2

                    C 55.5 32.0
                      54.5 27.3
                      53.3 22.5

                    C 52.2 18.0
                      51.0 13.4
                      50 9

                    Z
                  "
                  class="arrow-shadow"
                ></path>


                <path
                  d="
                    M 50 9

                    C 49.0 13.4
                      47.8 18.0
                      46.7 22.5

                    C 45.5 27.3
                      44.5 32.0
                      43.8 36.2

                    C 43.5 37.9
                      44.1 39.0
                      45.3 39.6

                    C 46.4 40.2
                      47.5 39.6
                      48.2 38.4

                    L 50 34.8

                    L 51.8 38.4

                    C 52.5 39.6
                      53.6 40.2
                      54.7 39.6

                    C 55.9 39.0
                      56.5 37.9
                      56.2 36.2

                    C 55.5 32.0
                      54.5 27.3
                      53.3 22.5

                    C 52.2 18.0
                      51.0 13.4
                      50 9

                    Z
                  "
                  class="arrow"
                ></path>


                <path
                  d="
                    M 50 12

                    C 49.3 16.2
                      48.5 20.5
                      47.6 24.5

                    C 46.9 28.0
                      46.3 31.0
                      46.0 33.7
                  "
                  class="arrow-highlight"
                ></path>

              </g>


              <!-- CENTER DISC -->

              <circle
                cx="50"
                cy="50"
                r="14.5"
                class="center-disc"
              ></circle>


              <!-- WIND SPEED -->

              <text
                x="50"
                y="49"
                class="speed-number"
              >
                ${speed}
              </text>


              <text
                x="50"
                y="58"
                class="speed-unit"
              >
                ${speedUnit}
              </text>


            </svg>

          </div>


          <!-- ======================== -->
          <!-- DATA -->
          <!-- ======================== -->

          <div class="wind-data">


            <div class="wind-info">


              <!-- DIRECTION NAME -->

              ${
                this.config.show_direction_name !== false
                  ? html`
                      <div class="direction-name">
                        ${compassDirection}
                      </div>
                    `
                  : ""
              }


              <!-- DIRECTION DETAILS -->

              ${
                this.config.show_direction !== false
                  ? html`
                      <div class="direction-detail">

                        Wind from
                        ${compassDirection}

                        <span class="degree">
                          ${Math.round(direction)}°
                        </span>

                      </div>
                    `
                  : ""
              }


              <!-- GUSTS -->

              ${
                this.config.show_gusts !== false &&
                gust !== null
                  ? html`
                      <div class="gust">

                        <span class="gust-label">
                          Gusts
                        </span>

                        <span class="gust-value">

                          ${gust}

                          <span class="gust-unit">
                            ${gustUnit}
                          </span>

                        </span>

                      </div>
                    `
                  : ""
              }


            </div>


            <!-- ======================== -->
            <!-- WIND SCALE -->
            <!-- ======================== -->

            <div class="wind-scale">


              <div class="scale-header">

                <span>
                  Wind
                </span>

                <span>
                  ${scale}+ ${speedUnit}
                </span>

              </div>


              <div class="scale-track">

                <div
                  class="scale-progress"
                  style="
                    width:
                    ${speedPercent}%;
                  "
                ></div>


                <div
                  class="scale-indicator"
                  style="
                    left:
                    ${speedPercent}%;
                  "
                ></div>

              </div>


              <div class="scale-values">

                <span>
                  0
                </span>

                <span>
                  ${Math.round(
                    scale * 0.25
                  )}
                </span>

                <span>
                  ${Math.round(
                    scale * 0.50
                  )}
                </span>

                <span>
                  ${Math.round(
                    scale * 0.75
                  )}
                </span>

                <span>
                  ${scale}+
                </span>

              </div>

            </div>


          </div>

        </div>

      </ha-card>
    `;
  }


  /* ================================= */
  /* CONFIG ELEMENT */
  /* ================================= */

  static getConfigElement() {

    return document.createElement(
      "wind-compass-card-editor"
    );
  }


  static getStubConfig() {

    return {

      title:
        "Wind",

      wind_speed_entity:
        "",

      wind_gust_entity:
        "",

      wind_dir_entity:
        "",

      show_header:
        true,

      show_header_icon:
        false,

      header_icon:
        "mdi:weather-windy",

      show_gusts:
        true,

      show_direction:
        true,

      show_direction_name:
        true,

      arrow_direction:
        "from",

      compass_size:
        250,

      max_wind_speed:
        30,

      data_position:
        "below",

      tap_action: {
        action:
          "none",
      },

      hold_action: {
        action:
          "none",
      },

      double_tap_action: {
        action:
          "none",
      },

    };
  }


  /* ================================= */
  /* CARD CSS */
  /* ================================= */

  static get styles() {

    return css`

      :host {
        display: block;
      }


      /* ============================= */
      /* CARD */
      /* ============================= */

      .wind-card {

        overflow:
          hidden;

        --wind-blue:
          var(
            --primary-color,
            #0a84ff
          );

        --wind-blue-light:
          #5ac8fa;

        --wind-blue-dark:
          #007aff;

        --wind-text:
          var(
            --primary-text-color
          );

        --wind-secondary:
          var(
            --secondary-text-color
          );

      }


      /* ============================= */
      /* HEADER */
      /* ============================= */

      .header {

        display:
          flex;

        align-items:
          center;

        gap:
          8px;

        padding:
          18px
          20px
          4px
          20px;

      }


      .header-icon {

        width:
          24px;

        height:
          24px;

        --mdc-icon-size:
          24px;

        color:
          var(--wind-blue);

        flex:
          0 0 auto;

      }


      .title {

        font-size:
          1.35rem;

        font-weight:
          600;

        letter-spacing:
          -0.3px;

        color:
          var(--wind-text);

      }


      /* ============================= */
      /* CONTENT */
      /* ============================= */

      .content {

        display:
          flex;

        align-items:
          center;

        justify-content:
          center;

        gap:
          22px;

        padding:
          4px
          18px
          20px;

      }


      /* ============================= */
      /* BELOW */
      /* ============================= */

      .position-below .content {

        flex-direction:
          column;

      }


      /* ============================= */
      /* LEFT */
      /* ============================= */

      .position-left .content {

        flex-direction:
          row;

      }


      .position-left .wind-data {

        order:
          1;

      }


      .position-left .wind-dial {

        order:
          2;

      }


      /* ============================= */
      /* RIGHT */
      /* ============================= */

      .position-right .content {

        flex-direction:
          row;

      }


      .position-right .wind-dial {

        order:
          1;

      }


      .position-right .wind-data {

        order:
          2;

      }


      /* ============================= */
      /* COMPASS */
      /* ============================= */

      .wind-dial {

        position:
          relative;

        width:
          var(--compass-size);

        height:
          var(--compass-size);

        max-width:
          100%;

        max-height:
          100%;

        flex:
          0 0 auto;

      }


      .dial-glow {

        position:
          absolute;

        inset:
          5%;

        border-radius:
          50%;

        background:
          radial-gradient(
            circle,

            rgba(
              10,
              132,
              255,
              0.13
            )
            0%,

            rgba(
              10,
              132,
              255,
              0.04
            )
            48%,

            transparent
            72%
          );

        filter:
          blur(5px);

        pointer-events:
          none;

      }


      .compass {

        width:
          100%;

        height:
          100%;

        overflow:
          visible;

      }


      /* ============================= */
      /* ARC */
      /* ============================= */

      .wind-arc-background {

        fill:
          none;

        stroke:
          color-mix(
            in srgb,
            var(--wind-blue)
            11%,
            transparent
          );

        stroke-width:
          2.1;

        stroke-linecap:
          round;

      }


      .wind-arc {

        fill:
          none;

        stroke:
          var(--wind-blue);

        stroke-width:
          2.4;

        stroke-linecap:
          round;

        filter:
          drop-shadow(
            0
            0
            2px
            rgba(
              10,
              132,
              255,
              0.35
            )
          );

        transition:
          d
          0.7s
          cubic-bezier(
            0.22,
            1,
            0.36,
            1
          );

      }


      .arc-dot {

        fill:
          var(--wind-blue);

        opacity:
          0.42;

      }


      /* ============================= */
      /* TICKS */
      /* ============================= */

      .tick {

        stroke:
          color-mix(
            in srgb,
            var(--primary-text-color)
            18%,
            transparent
          );

        stroke-width:
          0.38;

        stroke-linecap:
          round;

      }


      .tick.medium {

        stroke:
          color-mix(
            in srgb,
            var(--primary-text-color)
            30%,
            transparent
          );

        stroke-width:
          0.58;

      }


      .tick.major {

        stroke:
          color-mix(
            in srgb,
            var(--primary-text-color)
            48%,
            transparent
          );

        stroke-width:
          0.82;

      }


      /* ============================= */
      /* DIRECTIONS */
      /* ============================= */

      .direction-label {

        text-anchor:
          middle;

        dominant-baseline:
          middle;

        fill:
          var(--wind-secondary);

        user-select:
          none;

      }


      .direction-label.cardinal {

        font-size:
          6px;

        font-weight:
          600;

        fill:
          var(--wind-text);

      }


      .direction-label.secondary {

        font-size:
          3.3px;

        font-weight:
          500;

        opacity:
          0.60;

      }


      /* ============================= */
      /* WIND ARROW */
      /* ============================= */

      .wind-arrow {

        transform-box:
          view-box;

        transform-origin:
          50% 50%;

        transition:
          transform
          0.7s
          cubic-bezier(
            0.22,
            1,
            0.36,
            1
          );

      }


      .arrow {

        fill:
          var(--wind-blue);

        opacity:
          0.96;

        filter:
          drop-shadow(
            0
            1px
            2px
            rgba(
              0,
              0,
              0,
              0.16
            )
          );

      }


      .arrow-shadow {

        fill:
          var(--wind-blue);

        opacity:
          0.15;

        filter:
          blur(1.5px);

        transform:
          translateY(
            1px
          );

      }


      .arrow-highlight {

        fill:
          none;

        stroke:
          rgba(
            255,
            255,
            255,
            0.42
          );

        stroke-width:
          0.65;

        stroke-linecap:
          round;

        opacity:
          0.75;

      }


      /* ============================= */
      /* CENTER DISC */
      /* ============================= */

      .center-disc {

        fill:
          color-mix(
            in srgb,

            var(
              --ha-card-background,

              var(
                --card-background-color,
                #fff
              )
            )

            94%,

            var(--wind-blue)
          );

        stroke:
          color-mix(
            in srgb,
            var(--wind-blue)
            25%,
            transparent
          );

        stroke-width:
          0.8;

        filter:
          drop-shadow(
            0
            1px
            4px
            rgba(
              0,
              0,
              0,
              0.10
            )
          );

      }


      /* ============================= */
      /* CENTER SPEED */
      /* ============================= */

      .speed-number {

        text-anchor:
          middle;

        font-size:
          10px;

        font-weight:
          600;

        letter-spacing:
          -0.6px;

        fill:
          var(--wind-text);

        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "SF Pro Display",
          "SF Pro Text",
          system-ui,
          sans-serif;

      }


      .speed-unit {

        text-anchor:
          middle;

        font-size:
          3px;

        font-weight:
          500;

        fill:
          var(--wind-secondary);

      }


      /* ============================= */
      /* DATA CONTAINER */
      /* ============================= */

      .wind-data {

        display:
          flex;

        align-items:
          center;

        justify-content:
          center;

        min-width:
          0;

      }


      /* ============================= */
      /* BELOW DATA */
      /* ============================= */

      .position-below .wind-data {

        width:
          100%;

        flex-direction:
          column;

      }


      /* ============================= */
      /* SIDE DATA */
      /* ============================= */

      .position-left .wind-data,
      .position-right .wind-data {

        width:
          210px;

        flex:
          0 1 210px;

        flex-direction:
          column;

      }


      /* ============================= */
      /* WIND INFO */
      /* ============================= */

      .wind-info {

        text-align:
          center;

      }


      .direction-name {

        font-size:
          1.7rem;

        font-weight:
          600;

        letter-spacing:
          -0.5px;

        color:
          var(--wind-text);

      }


      .direction-detail {

        margin-top:
          1px;

        font-size:
          0.9rem;

        color:
          var(--wind-secondary);

      }


      .degree {

        margin-left:
          5px;

        opacity:
          0.72;

      }


      /* ============================= */
      /* GUST */
      /* ============================= */

      .gust {

        display:
          flex;

        align-items:
          baseline;

        justify-content:
          center;

        gap:
          6px;

        margin-top:
          7px;

      }


      .gust-label {

        font-size:
          0.82rem;

        color:
          var(--wind-secondary);

      }


      .gust-value {

        font-size:
          0.95rem;

        font-weight:
          500;

        color:
          var(--wind-text);

      }


      .gust-unit {

        font-size:
          0.75rem;

        color:
          var(--wind-secondary);

      }


      /* ============================= */
      /* SPEED SCALE */
      /* ============================= */

      .wind-scale {

        width:
          100%;

        max-width:
          420px;

        margin-top:
          18px;

      }


      .position-left .wind-scale,
      .position-right .wind-scale {

        max-width:
          210px;

      }


      .scale-header {

        display:
          flex;

        justify-content:
          space-between;

        margin-bottom:
          7px;

        font-size:
          0.72rem;

        font-weight:
          500;

        color:
          var(--wind-secondary);

      }


      .scale-track {

        position:
          relative;

        height:
          5px;

        border-radius:
          10px;

        background:
          color-mix(
            in srgb,
            var(--wind-blue)
            12%,
            transparent
          );

      }


      .scale-progress {

        position:
          absolute;

        left:
          0;

        top:
          0;

        bottom:
          0;

        border-radius:
          10px;

        background:
          linear-gradient(
            90deg,
            var(--wind-blue-light),
            var(--wind-blue)
          );

        transition:
          width
          0.7s
          cubic-bezier(
            0.22,
            1,
            0.36,
            1
          );

      }


      .scale-indicator {

        position:
          absolute;

        top:
          50%;

        width:
          11px;

        height:
          11px;

        transform:
          translate(
            -50%,
            -50%
          );

        border-radius:
          50%;

        background:
          var(--wind-blue);

        border:
          2px solid
          var(
            --card-background-color,
            #fff
          );

        box-shadow:
          0
          1px
          4px
          rgba(
            0,
            0,
            0,
            0.22
          );

        transition:
          left
          0.7s
          cubic-bezier(
            0.22,
            1,
            0.36,
            1
          );

      }


      .scale-values {

        display:
          flex;

        justify-content:
          space-between;

        margin-top:
          6px;

        font-size:
          0.63rem;

        color:
          var(--wind-secondary);

      }


      /* ============================= */
      /* MOBILE */
      /* ============================= */

      @media (max-width: 600px) {

        .content {

          flex-direction:
            column !important;

          gap:
            8px;

          padding-left:
            10px;

          padding-right:
            10px;

        }


        .wind-dial {

          --compass-size:
            215px !important;

        }


        .wind-data {

          width:
            100% !important;

          flex:
            none !important;

        }


        .wind-scale {

          max-width:
            420px !important;

        }


        .direction-name {

          font-size:
            1.5rem;

        }

      }

    `;
  }
}


/* ================================= */
/* VISUAL EDITOR */
/* ================================= */

class WindCompassCardEditor
  extends LitElement {


  static get properties() {

    return {

      hass: {},

      config: {},

    };
  }


  setConfig(config) {

    this.config = config;
  }


  _valueChanged(ev) {

    const newConfig = {

      ...this.config,

      ...ev.detail.value,

    };


    this.config =
      newConfig;


    this.dispatchEvent(

      new CustomEvent(
        "config-changed",
        {

          detail: {
            config:
              newConfig,
          },

          bubbles:
            true,

          composed:
            true,

        }
      )

    );
  }


  render() {

    if (!this.hass) {
      return html``;
    }


    const schema = [


      /* ============================= */
      /* BASIC */
      /* ============================= */

      {
        name:
          "title",

        selector: {
          text: {},
        },
      },


      {
        name:
          "show_header",

        selector: {
          boolean: {},
        },
      },


      {
        name:
          "show_header_icon",

        selector: {
          boolean: {},
        },
      },


      {
        name:
          "header_icon",

        selector: {
          icon: {},
        },
      },


      /* ============================= */
      /* ENTITIES */
      /* ============================= */

      {

        name:
          "",

        type:
          "grid",

        schema: [

          {

            name:
              "wind_speed_entity",

            selector: {

              entity: {

                domain:
                  "sensor",

              },

            },

          },


          {

            name:
              "wind_gust_entity",

            selector: {

              entity: {

                domain:
                  "sensor",

              },

            },

          },


          {

            name:
              "wind_dir_entity",

            selector: {

              entity: {

                domain:
                  "sensor",

              },

            },

          },

        ],

      },


      /* ============================= */
      /* DISPLAY */
      /* ============================= */

      {

        title:
          "Display",

        name:
          "",

        type:
          "expandable",

        schema: [

          {

            name:
              "show_gusts",

            selector: {
              boolean: {},
            },

          },


          {

            name:
              "show_direction",

            selector: {
              boolean: {},
            },

          },


          {

            name:
              "show_direction_name",

            selector: {
              boolean: {},
            },

          },


          {

            name:
              "arrow_direction",

            selector: {

              select: {

                options: [

                  {

                    value:
                      "from",

                    label:
                      "From",

                  },

                  {

                    value:
                      "to",

                    label:
                      "To",

                  },

                ],

                mode:
                  "dropdown",

              },

            },

          },


          {

            name:
              "data_position",

            selector: {

              select: {

                options: [

                  {

                    value:
                      "below",

                    label:
                      "Below",

                  },

                  {

                    value:
                      "left",

                    label:
                      "Left",

                  },

                  {

                    value:
                      "right",

                    label:
                      "Right",

                  },

                ],

                mode:
                  "dropdown",

              },

            },

          },


          {

            name:
              "compass_size",

            selector: {

              number: {

                min:
                  160,

                max:
                  340,

                step:
                  10,

                mode:
                  "slider",

              },

            },

          },


          {

            name:
              "max_wind_speed",

            selector: {

              number: {

                min:
                  10,

                max:
                  100,

                step:
                  5,

                mode:
                  "slider",

              },

            },

          },

        ],

      },


      /* ============================= */
      /* ACTIONS - LAST */
      /* ============================= */

      {

        title:
          "Actions",

        name:
          "",

        type:
          "expandable",

        schema: [

          {

            name:
              "tap_action",

            selector: {
              ui_action: {},
            },

          },


          {

            name:
              "hold_action",

            selector: {
              ui_action: {},
            },

          },


          {

            name:
              "double_tap_action",

            selector: {
              ui_action: {},
            },

          },

        ],

      },

    ];


    return html`

      <ha-form

        .hass="${this.hass}"

        .data="${this.config}"

        .schema="${schema}"

        .computeLabel="${this._computeLabel}"

        @value-changed="${this._valueChanged}"

      ></ha-form>

    `;
  }


  _computeLabel = (schema) => {

    const labels = {

      title:
        "Title",

      show_header:
        "Show header",

      show_header_icon:
        "Show header icon",

      header_icon:
        "Header icon",

      wind_speed_entity:
        "Wind speed entity",

      wind_gust_entity:
        "Wind gust entity",

      wind_dir_entity:
        "Wind direction entity",

      show_gusts:
        "Show gusts",

      show_direction:
        "Show direction",

      show_direction_name:
        "Show direction name",

      arrow_direction:
        "Arrow direction",

      data_position:
        "Data position",

      compass_size:
        "Compass size",

      max_wind_speed:
        "Base wind scale",

      tap_action:
        "Tap action",

      hold_action:
        "Hold action",

      double_tap_action:
        "Double tap action",

    };


    return (
      labels[schema.name] ||
      schema.name
    );
  };

}


/* ================================= */
/* REGISTER CARD */
/* ================================= */

customElements.define(
  "wind-compass-card",
  WindCompassCard
);


customElements.define(
  "wind-compass-card-editor",
  WindCompassCardEditor
);


window.customCards =
  window.customCards || [];


window.customCards.push({

  type:
    "wind-compass-card",

  name:
    "Wind Compass Card",

  description:
    "Apple iPad Weather inspired wind card",

  preview:
    true,

});
