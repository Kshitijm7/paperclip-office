// Override of upstream Character.ts: registers/unregisters each live sprite so
// src/ui/agentLabels.ts can read its world position every frame (nameplates,
// issue tags and state rings must follow the character as it walks).
import { Character as UpstreamCharacter } from "../../vendor/munder-difflin/src/renderer/src/scene/office/Character.js";
import { registerCharacter, unregisterCharacter } from "../ui/agentLabels.js";
import { t } from "../adapters/i18n.js";

const QUIET = () => new Set([t("office.activity.idle"), t("office.activity.waiting")]);

export { paintCup } from "../../vendor/munder-difflin/src/renderer/src/scene/office/Character.js";

export class Character extends UpstreamCharacter {
  constructor(...args: ConstructorParameters<typeof UpstreamCharacter>) {
    super(...args);
    registerCharacter(this.agentId, this);
  }

  override showThought(text: string, tool?: string): void {
    if (QUIET().has(text.trim())) {
      this.hideThought();
      return;
    }
    super.showThought(text, tool);
  }

  override destroy(): void {
    unregisterCharacter(this.agentId);
    super.destroy();
  }
}
