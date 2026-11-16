/* eslint-disable */
import { TypeStore } from "@needle-tools/engine"

// Import types
import { Rotate } from "../scripts/Rotate.js";

// Register types
export function registerTypes() {
	TypeStore.add("Rotate", Rotate);
}
registerTypes();
