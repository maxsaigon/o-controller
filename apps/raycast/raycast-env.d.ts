/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Service URL - URL of the O-Control service */
  "serviceUrl": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `power-toggle` command */
  export type PowerToggle = ExtensionPreferences & {}
  /** Preferences accessible in the `volume-up` command */
  export type VolumeUp = ExtensionPreferences & {}
  /** Preferences accessible in the `volume-down` command */
  export type VolumeDown = ExtensionPreferences & {}
  /** Preferences accessible in the `volume-set` command */
  export type VolumeSet = ExtensionPreferences & {}
  /** Preferences accessible in the `mute-toggle` command */
  export type MuteToggle = ExtensionPreferences & {}
  /** Preferences accessible in the `input-switch` command */
  export type InputSwitch = ExtensionPreferences & {}
  /** Preferences accessible in the `run-preset` command */
  export type RunPreset = ExtensionPreferences & {}
  /** Preferences accessible in the `show-status` command */
  export type ShowStatus = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `power-toggle` command */
  export type PowerToggle = {}
  /** Arguments passed to the `volume-up` command */
  export type VolumeUp = {}
  /** Arguments passed to the `volume-down` command */
  export type VolumeDown = {}
  /** Arguments passed to the `volume-set` command */
  export type VolumeSet = {
  /** 0-100 */
  "level": string
}
  /** Arguments passed to the `mute-toggle` command */
  export type MuteToggle = {}
  /** Arguments passed to the `input-switch` command */
  export type InputSwitch = {}
  /** Arguments passed to the `run-preset` command */
  export type RunPreset = {}
  /** Arguments passed to the `show-status` command */
  export type ShowStatus = {}
}

