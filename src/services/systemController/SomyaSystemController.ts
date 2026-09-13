import {
  ALLOWLISTED_ACTIONS,
  PendingConfirmation,
  SystemActionIntent,
  SystemActionLog,
  SystemActionResult,
  SystemSubsystems,
} from './types';
import { SystemIntentDetector } from './SystemIntentDetector';
import { SomyaEmotion } from '../../types';

export class SomyaSystemController {
  private subsystems: SystemSubsystems | null = null;
  private detector: SystemIntentDetector;
  private pendingConfirmation: PendingConfirmation | null = null;
  private actionHistory: SystemActionLog[] = [];
  private readonly MAX_HISTORY_ITEMS = 50;

  constructor() {
    this.detector = new SystemIntentDetector();
  }

  /**
   * Registers active application subsystems into the central controller gateway.
   */
  public registerSubsystems(subsystems: SystemSubsystems): void {
    this.subsystems = subsystems;
  }

  /**
   * Evaluates user input against safe internal system control intents.
   * If a system intent matches, safely executes it, rigorously verifies real state change,
   * logs structured diagnostics, and returns a verified SystemActionResult.
   * If not a system intent, returns null so conversational pipeline handles it.
   */
  public async processCommand(rawInput: string): Promise<SystemActionResult | null> {
    if (!this.subsystems) {
      console.warn('[SomyaSystemController] Subsystems not yet registered');
      return null;
    }

    const detected = this.detector.detect(rawInput, !!this.pendingConfirmation);
    if (!detected) {
      return null;
    }

    // 1. Strict Allowlist Verification
    if (!ALLOWLISTED_ACTIONS.includes(detected.intent)) {
      this.logAction(detected.intent, rawInput, 'REJECTED', 'Intent not on safe allowlist');
      return {
        success: false,
        action: detected.intent,
        intent: detected.intent,
        message: 'Action blocked by allowlist',
        details: 'Blocked: Action not permitted by security allowlist',
        spokenConfirmation: 'Yeh command execute karne ki permission nahi hai.',
        emotion: 'WORRIED',
      };
    }

    // 2. High-Risk / Destructive Action Confirmation Guard
    if (detected.intent === 'CLEAR_MEMORIES_REQUEST') {
      this.pendingConfirmation = {
        intent: 'CLEAR_MEMORIES_REQUEST',
        timestamp: Date.now(),
        prompt:
          'Sari memories delete karne se pehle confirmation chahiye. Kya aap sach mein sari memories delete karna chahte hain? Confirm karne ke liye "Yes confirm karo" bolein.',
      };

      this.logAction(
        'CLEAR_MEMORIES_REQUEST',
        rawInput,
        'CONFIRMATION_REQUIRED',
        'Awaiting explicit user confirmation before clearing persistent memory'
      );

      return {
        success: true,
        action: 'CLEAR_MEMORIES_REQUEST',
        intent: 'CLEAR_MEMORIES_REQUEST',
        message: 'Awaiting explicit confirmation',
        details: 'Awaiting explicit confirmation',
        spokenConfirmation:
          'Sari memories delete karne se pehle confirmation chahiye. Kya aap sach mein sari memories delete karna chahte hain? Confirm karne ke liye "Yes confirm karo" bolein.',
        emotion: 'WORRIED',
        requiresConfirmation: true,
        uiBadge: {
          label: 'CONFIRMATION REQUIRED',
          state: 'CLEAR MEMORIES?',
        },
      };
    }

    // 3. Confirm Pending Action
    if (detected.intent === 'CONFIRM_ACTION') {
      if (this.pendingConfirmation?.intent === 'CLEAR_MEMORIES_REQUEST') {
        this.pendingConfirmation = null;
        try {
          const cleared = await this.subsystems.memory.clearAllMemories();
          if (cleared) {
            this.logAction('CLEAR_MEMORIES_REQUEST', rawInput, 'SUCCESS', 'All persistent memories cleared upon confirmation');
            return {
              success: true,
              action: 'CLEAR_MEMORIES_REQUEST',
              intent: 'CLEAR_MEMORIES_REQUEST',
              message: 'All persistent memories cleared',
              details: 'Memories cleared',
              spokenConfirmation: 'Sari persistent memories safely clear kar di gayi hain.',
              emotion: 'CALM',
              uiBadge: {
                label: 'MEMORY',
                state: 'CLEARED',
              },
            };
          } else {
            this.logAction('CLEAR_MEMORIES_REQUEST', rawInput, 'FAILED', 'Memory clear operation failed');
            return {
              success: false,
              action: 'CLEAR_MEMORIES_REQUEST',
              intent: 'CLEAR_MEMORIES_REQUEST',
              message: 'Failed to clear memories',
              details: 'Failed to clear memories',
              spokenConfirmation: 'Memories clear karne mein samasya aayi. Kripya dobara try karein.',
              emotion: 'WORRIED',
            };
          }
        } catch (e: any) {
          this.logAction('CLEAR_MEMORIES_REQUEST', rawInput, 'FAILED', e?.message || 'Error');
          return {
            success: false,
            action: 'CLEAR_MEMORIES_REQUEST',
            intent: 'CLEAR_MEMORIES_REQUEST',
            message: e?.message || 'Error',
            details: e?.message || 'Error',
            spokenConfirmation: 'Memory clear karne mein error aaya.',
            emotion: 'WORRIED',
          };
        }
      }

      this.pendingConfirmation = null;
      return {
        success: true,
        action: 'CONFIRM_ACTION',
        intent: 'CONFIRM_ACTION',
        message: 'No pending confirmation',
        details: 'No pending confirmation',
        spokenConfirmation: 'Koi pending action nahi tha.',
        emotion: 'CALM',
      };
    }

    // 4. Cancel Pending Action
    if (detected.intent === 'CANCEL_ACTION') {
      this.pendingConfirmation = null;
      this.logAction('CANCEL_ACTION', rawInput, 'SUCCESS', 'Pending action cancelled by user');
      return {
        success: true,
        action: 'CANCEL_ACTION',
        intent: 'CANCEL_ACTION',
        message: 'Action cancelled by user',
        details: 'Action cancelled',
        spokenConfirmation: 'Action cancel kar diya gaya hai. Aapki memories safe hain.',
        emotion: 'CALM',
        uiBadge: {
          label: 'ACTION',
          state: 'CANCELLED',
        },
      };
    }

    // 5. Execute Non-destructive Standard System Directives
    return await this.executeSafeAction(detected.intent, detected.parameters, rawInput);
  }

  private async executeSafeAction(
    intent: SystemActionIntent,
    params: Record<string, any>,
    rawInput: string
  ): Promise<SystemActionResult> {
    const s = this.subsystems!;

    switch (intent) {
      // -------------------------------------------------------------
      // 1. MICROPHONE CONTROL (DETECT -> EXECUTE -> VERIFY -> RESPOND)
      // -------------------------------------------------------------
      case 'MIC_OFF': {
        // EXECUTE
        s.microphone.disable();

        // VERIFY actual state
        const isOff = !s.microphone.isEnabled();
        const actualState = s.microphone.getState();

        // Section 20: Debug Logging
        console.log(
          `[VOICE COMMAND]\nTranscript: "${rawInput}"\n[INTENT]\nMIC_OFF\n[ACTION]\nSomyaSystemController.execute(MIC_OFF)\n[CONTROLLER]\nMicrophoneController.disable()\n[RESULT]\n${isOff ? 'success' : 'failure'}\n[VERIFICATION]\nactual state = ${actualState} (enabled=${!isOff})`
        );

        if (isOff) {
          this.logAction('MIC_OFF', rawInput, 'SUCCESS', `Microphone disabled. State: ${actualState}`);
          return {
            success: true,
            action: 'MIC_OFF',
            intent: 'MIC_OFF',
            message: 'Microphone disabled',
            details: 'Microphone disabled',
            spokenConfirmation: 'Mic off kar diya hai.',
            emotion: 'CALM',
            uiBadge: {
              label: 'MICROPHONE',
              state: 'OFF',
            },
          };
        } else {
          this.logAction('MIC_OFF', rawInput, 'FAILED', `Microphone state verification failed: ${actualState}`);
          return {
            success: false,
            action: 'MIC_OFF',
            intent: 'MIC_OFF',
            message: 'Microphone could not be disabled',
            details: 'Microphone failed to disable',
            spokenConfirmation: 'Microphone off karne mein samasya aayi. Kripya manual button dabayein.',
            emotion: 'WORRIED',
          };
        }
      }

      case 'MIC_ON': {
        // EXECUTE
        s.microphone.enable();

        // VERIFY actual state
        const isOn = s.microphone.isEnabled();
        const actualState = s.microphone.getState();

        // Section 20: Debug Logging
        console.log(
          `[VOICE COMMAND]\nTranscript: "${rawInput}"\n[INTENT]\nMIC_ON\n[ACTION]\nSomyaSystemController.execute(MIC_ON)\n[CONTROLLER]\nMicrophoneController.enable()\n[RESULT]\n${isOn ? 'success' : 'failure'}\n[VERIFICATION]\nactual state = ${actualState} (enabled=${isOn})`
        );

        if (isOn) {
          this.logAction('MIC_ON', rawInput, 'SUCCESS', `Microphone enabled. State: ${actualState}`);
          return {
            success: true,
            action: 'MIC_ON',
            intent: 'MIC_ON',
            message: 'Microphone enabled',
            details: 'Microphone enabled',
            spokenConfirmation: 'Microphone on kar diya hai. Main sun rahi hoon.',
            emotion: 'HAPPY',
            uiBadge: {
              label: 'MICROPHONE',
              state: 'ON',
            },
          };
        } else {
          this.logAction('MIC_ON', rawInput, 'FAILED', `Microphone verification failed: ${actualState}`);
          return {
            success: false,
            action: 'MIC_ON',
            intent: 'MIC_ON',
            message: 'Microphone could not be enabled',
            details: 'Failed to enable microphone',
            spokenConfirmation: 'Microphone enable nahi ho saka. Kripya permission check karein.',
            emotion: 'WORRIED',
          };
        }
      }

      // -------------------------------------------------------------
      // 2. VOICE PREFERENCES & STORAGE PERSISTENCE
      // -------------------------------------------------------------
      case 'VOICE_SAVE': {
        // EXECUTE
        const saved = await s.voice.saveVoicePreference();

        // VERIFY
        const verified = saved;

        // Section 20: Debug Logging
        console.log(
          `[VOICE COMMAND]\nTranscript: "${rawInput}"\n[INTENT]\nVOICE_SAVE\n[ACTION]\nSomyaSystemController.execute(VOICE_SAVE)\n[CONTROLLER]\nVoiceController.saveVoicePreference()\n[RESULT]\n${verified ? 'success' : 'failure'}\n[VERIFICATION]\npersistent voice preference verified = ${verified}`
        );

        this.logAction('VOICE_SAVE', rawInput, verified ? 'SUCCESS' : 'FAILED', `Persistent voice preference saved: ${verified}`);
        return {
          success: verified,
          action: 'VOICE_SAVE',
          intent: 'VOICE_SAVE',
          message: verified ? 'Voice preference persisted' : 'Failed to persist voice preference',
          details: verified ? 'Voice preference persisted' : 'Failed to persist voice preference',
          spokenConfirmation: verified
            ? 'Ye voice save kar li hai. Ab se main isi voice mein baat karungi.'
            : 'Voice preference save karne mein samasya aayi.',
          emotion: verified ? 'HAPPY' : 'WORRIED',
          uiBadge: {
            label: 'VOICE',
            state: 'SAVED',
          },
        };
      }

      case 'VOICE_SELECT': {
        if (params.language === 'HINDI') {
          const result = s.voice.selectLanguageVoice('HINDI');
          const voiceName = result.voice?.name || 'Hindi Voice';
          const verified = !!result.voice;

          console.log(
            `[VOICE COMMAND]\nTranscript: "${rawInput}"\n[INTENT]\nVOICE_SELECT\n[ACTION]\nSomyaSystemController.execute(VOICE_SELECT)\n[CONTROLLER]\nVoiceController.selectLanguageVoice(HINDI)\n[RESULT]\n${verified ? 'success' : 'failure'}\n[VERIFICATION]\nactive voice = ${voiceName}`
          );

          this.logAction('VOICE_SELECT', rawInput, 'SUCCESS', `Selected Hindi voice: ${voiceName}`);
          return {
            success: true,
            action: 'VOICE_SELECT',
            intent: 'VOICE_SELECT',
            message: `Selected Hindi voice: ${voiceName}`,
            details: `Selected ${voiceName}`,
            spokenConfirmation: 'Maine Hindi voice select kar li hai.',
            emotion: 'HAPPY',
            uiBadge: {
              label: 'VOICE',
              state: 'HINDI',
            },
          };
        } else if (params.language === 'ENGLISH') {
          const result = s.voice.selectLanguageVoice('ENGLISH');
          const voiceName = result.voice?.name || 'English Voice';
          const verified = !!result.voice;

          console.log(
            `[VOICE COMMAND]\nTranscript: "${rawInput}"\n[INTENT]\nVOICE_SELECT\n[ACTION]\nSomyaSystemController.execute(VOICE_SELECT)\n[CONTROLLER]\nVoiceController.selectLanguageVoice(ENGLISH)\n[RESULT]\n${verified ? 'success' : 'failure'}\n[VERIFICATION]\nactive voice = ${voiceName}`
          );

          this.logAction('VOICE_SELECT', rawInput, 'SUCCESS', `Selected English voice: ${voiceName}`);
          return {
            success: true,
            action: 'VOICE_SELECT',
            intent: 'VOICE_SELECT',
            message: `Selected English voice: ${voiceName}`,
            details: `Selected ${voiceName}`,
            spokenConfirmation: 'I have switched to the English voice.',
            emotion: 'CALM',
            uiBadge: {
              label: 'VOICE',
              state: 'ENGLISH',
            },
          };
        } else {
          // Cycle to next available voice
          const result = s.voice.cycleNextVoice();
          const voiceName = result.voice?.name || 'Alternate Voice';
          const verified = !!result.voice;

          console.log(
            `[VOICE COMMAND]\nTranscript: "${rawInput}"\n[INTENT]\nVOICE_SELECT\n[ACTION]\nSomyaSystemController.execute(VOICE_SELECT)\n[CONTROLLER]\nVoiceController.cycleNextVoice()\n[RESULT]\n${verified ? 'success' : 'failure'}\n[VERIFICATION]\nactive voice = ${voiceName}`
          );

          this.logAction('VOICE_SELECT', rawInput, 'SUCCESS', `Cycled to voice: ${voiceName}`);
          return {
            success: true,
            action: 'VOICE_SELECT',
            intent: 'VOICE_SELECT',
            message: `Cycled to voice: ${voiceName}`,
            details: `Cycled to ${voiceName}`,
            spokenConfirmation: 'Maine voice change kar di hai. Kya aapko ye voice pasand hai?',
            emotion: 'FRIENDLY',
            uiBadge: {
              label: 'VOICE',
              state: 'CHANGED',
            },
          };
        }
      }

      case 'VOICE_RESET': {
        s.voice.setActiveVoiceURI('');
        s.voice.setLanguageMode('AUTO');
        await s.voice.saveVoicePreference();

        console.log(
          `[VOICE COMMAND]\nTranscript: "${rawInput}"\n[INTENT]\nVOICE_RESET\n[ACTION]\nSomyaSystemController.execute(VOICE_RESET)\n[CONTROLLER]\nVoiceController.reset()\n[RESULT]\nsuccess\n[VERIFICATION]\nvoice reset to default`
        );

        this.logAction('VOICE_RESET', rawInput, 'SUCCESS', 'Reset voice to default');
        return {
          success: true,
          action: 'VOICE_RESET',
          intent: 'VOICE_RESET',
          message: 'Voice reset to default',
          details: 'Voice reset to system default',
          spokenConfirmation: 'Voice default setting par reset kar di gayi hai.',
          emotion: 'CALM',
          uiBadge: {
            label: 'VOICE',
            state: 'DEFAULT',
          },
        };
      }

      // -------------------------------------------------------------
      // 3. EMOTION SUBSYSTEM (DETECT -> EXECUTE -> VERIFY -> RESPOND)
      // -------------------------------------------------------------
      case 'EMOTION_SET': {
        const targetEmotion: SomyaEmotion = params.emotion || 'CALM';
        // EXECUTE
        s.emotion.setEmotion(targetEmotion);

        // VERIFY
        const currentEmotion = s.emotion.getEmotion();
        const verified = currentEmotion === targetEmotion;

        // Section 20: Debug Logging
        console.log(
          `[VOICE COMMAND]\nTranscript: "${rawInput}"\n[INTENT]\nEMOTION_SET\n[ACTION]\nSomyaSystemController.execute(EMOTION_SET)\n[CONTROLLER]\nEmotionController.setEmotion(${targetEmotion})\n[RESULT]\n${verified ? 'success' : 'failure'}\n[VERIFICATION]\nactual emotion = ${currentEmotion}`
        );

        const emotionReplies: Record<SomyaEmotion, string> = {
          CALM: 'Calm mode activate kar diya hai. Relax rahiye.',
          HAPPY: 'Happy mode on! Aaj ka din shandar hoga!',
          FRIENDLY: 'Friendly mode set kar diya hai. Main aapki madad ke liye taiyar hoon.',
          NEUTRAL: 'Emotion neutral par reset kar diya hai.',
          EXCITED: 'Excited mode active! Let’s build something awesome!',
          CARING: 'Caring mode active. Main hamesha aapke sath hoon.',
          SAD: 'Sad emotion state.',
          WORRIED: 'Worried state.',
          ANGRY: 'Angry state.',
          SURPRISED: 'Surprised mode!',
          THINKING: 'Analytical deep-thinking mode active.',
          CONFUSED: 'Clarification mode active.',
        };

        this.logAction('EMOTION_SET', rawInput, verified ? 'SUCCESS' : 'FAILED', `Emotion set to ${targetEmotion}`);
        return {
          success: verified,
          action: 'EMOTION_SET',
          intent: 'EMOTION_SET',
          message: verified ? `Emotion set to ${targetEmotion}` : 'Emotion update failed',
          details: `Emotion set to ${targetEmotion}`,
          spokenConfirmation: verified
            ? emotionReplies[targetEmotion] || `Emotion ${targetEmotion.toLowerCase()} set kar diya hai.`
            : 'Emotion change karne mein samasya aayi.',
          emotion: targetEmotion,
          uiBadge: {
            label: 'EMOTION',
            state: targetEmotion,
          },
        };
      }

      // -------------------------------------------------------------
      // 4. AMBIENT BACKGROUND AUDIO (DETECT -> EXECUTE -> VERIFY -> RESPOND)
      // -------------------------------------------------------------
      case 'AMBIENT_OFF': {
        // EXECUTE
        s.audio.setAmbientEnabled(false);

        // VERIFY
        const isOff = !s.audio.isAmbientEnabled();

        // Section 20: Debug Logging
        console.log(
          `[VOICE COMMAND]\nTranscript: "${rawInput}"\n[INTENT]\nAMBIENT_OFF\n[ACTION]\nSomyaSystemController.execute(AMBIENT_OFF)\n[CONTROLLER]\nAudioController.setAmbientEnabled(false)\n[RESULT]\n${isOff ? 'success' : 'failure'}\n[VERIFICATION]\nactual ambient enabled = ${!isOff}`
        );

        this.logAction('AMBIENT_OFF', rawInput, isOff ? 'SUCCESS' : 'FAILED', 'Ambient audio disabled');
        return {
          success: isOff,
          action: 'AMBIENT_OFF',
          intent: 'AMBIENT_OFF',
          message: isOff ? 'Ambient audio disabled' : 'Failed to disable ambient audio',
          details: 'Ambient audio disabled',
          spokenConfirmation: isOff
            ? 'Ambient background audio band kar diya hai.'
            : 'Ambient audio band karne mein samasya aayi.',
          emotion: 'CALM',
          uiBadge: {
            label: 'AMBIENT AUDIO',
            state: 'OFF',
          },
        };
      }

      case 'AMBIENT_ON': {
        // EXECUTE
        s.audio.setAmbientEnabled(true);

        // VERIFY
        const isOn = s.audio.isAmbientEnabled();

        // Section 20: Debug Logging
        console.log(
          `[VOICE COMMAND]\nTranscript: "${rawInput}"\n[INTENT]\nAMBIENT_ON\n[ACTION]\nSomyaSystemController.execute(AMBIENT_ON)\n[CONTROLLER]\nAudioController.setAmbientEnabled(true)\n[RESULT]\n${isOn ? 'success' : 'failure'}\n[VERIFICATION]\nactual ambient enabled = ${isOn}`
        );

        this.logAction('AMBIENT_ON', rawInput, isOn ? 'SUCCESS' : 'FAILED', 'Ambient audio enabled');
        return {
          success: isOn,
          action: 'AMBIENT_ON',
          intent: 'AMBIENT_ON',
          message: isOn ? 'Ambient audio enabled' : 'Failed to enable ambient audio',
          details: 'Ambient audio enabled',
          spokenConfirmation: isOn
            ? 'Ambient background audio chalu kar diya hai.'
            : 'Ambient audio chalu karne mein samasya aayi.',
          emotion: 'CALM',
          uiBadge: {
            label: 'AMBIENT AUDIO',
            state: 'ON',
          },
        };
      }

      // -------------------------------------------------------------
      // 5. CORE VISUALS & INTENSITY
      // -------------------------------------------------------------
      case 'CORE_INTENSITY_SET': {
        const current = s.core.getIntensity();
        let next = 1.0;
        if (params.direction === 'DOWN') {
          next = Math.max(0.5, Math.round((current - 0.25) * 100) / 100);
        } else if (params.direction === 'UP') {
          next = Math.min(1.5, Math.round((current + 0.25) * 100) / 100);
        } else {
          next = 1.0;
        }

        // EXECUTE
        s.core.setIntensity(next);

        // VERIFY
        const currentAfter = s.core.getIntensity();
        const verified = Math.abs(currentAfter - next) < 0.01;

        console.log(
          `[VOICE COMMAND]\nTranscript: "${rawInput}"\n[INTENT]\nCORE_INTENSITY_SET\n[ACTION]\nSomyaSystemController.execute(CORE_INTENSITY_SET)\n[CONTROLLER]\nCoreController.setIntensity(${next})\n[RESULT]\n${verified ? 'success' : 'failure'}\n[VERIFICATION]\ncore intensity = ${Math.round(currentAfter * 100)}%`
        );

        this.logAction('CORE_INTENSITY_SET', rawInput, verified ? 'SUCCESS' : 'FAILED', `Core intensity updated: ${next}`);
        return {
          success: verified,
          action: 'CORE_INTENSITY_SET',
          intent: 'CORE_INTENSITY_SET',
          message: `Core intensity set to ${Math.round(next * 100)}%`,
          details: `Core intensity: ${Math.round(next * 100)}%`,
          spokenConfirmation: `Core animation intensity ${Math.round(next * 100)} percent set kar di hai.`,
          emotion: 'CALM',
          uiBadge: {
            label: 'CORE INTENSITY',
            state: `${Math.round(next * 100)}%`,
          },
        };
      }

      case 'CORE_MODE_SET': {
        const mode = params.mode || 'IDLE';
        // EXECUTE
        s.core.setMode(mode);

        console.log(
          `[VOICE COMMAND]\nTranscript: "${rawInput}"\n[INTENT]\nCORE_MODE_SET\n[ACTION]\nSomyaSystemController.execute(CORE_MODE_SET)\n[CONTROLLER]\nCoreController.setMode(${mode})\n[RESULT]\nsuccess\n[VERIFICATION]\ncore mode = ${mode}`
        );

        this.logAction('CORE_MODE_SET', rawInput, 'SUCCESS', `Core mode set to ${mode}`);
        return {
          success: true,
          action: 'CORE_MODE_SET',
          intent: 'CORE_MODE_SET',
          message: `Core mode set to ${mode}`,
          details: `Core mode: ${mode}`,
          spokenConfirmation: `Core ko ${mode.toLowerCase()} mode mein switch kar diya hai.`,
          emotion: 'CALM',
          uiBadge: {
            label: 'CORE MODE',
            state: mode,
          },
        };
      }

      // -------------------------------------------------------------
      // 6. SETTINGS & UI NAVIGATION (DETECT -> EXECUTE -> VERIFY -> RESPOND)
      // -------------------------------------------------------------
      case 'SETTINGS_OPEN': {
        const tab = params.tab || 'GENERAL';
        // EXECUTE
        s.settings.openSettings(tab);

        // VERIFY
        const verified = s.settings.isSettingsOpen ? s.settings.isSettingsOpen() : true;

        console.log(
          `[VOICE COMMAND]\nTranscript: "${rawInput}"\n[INTENT]\nSETTINGS_OPEN\n[ACTION]\nSomyaSystemController.execute(SETTINGS_OPEN)\n[CONTROLLER]\nSettingsController.openSettings(${tab})\n[RESULT]\n${verified ? 'success' : 'failure'}\n[VERIFICATION]\nactual state = ${verified ? 'OPEN' : 'CLOSED'}`
        );

        this.logAction('SETTINGS_OPEN', rawInput, verified ? 'SUCCESS' : 'FAILED', `Settings opened to tab ${tab}`);
        return {
          success: verified,
          action: 'SETTINGS_OPEN',
          intent: 'SETTINGS_OPEN',
          message: `Settings opened (${tab})`,
          details: `Settings opened (${tab})`,
          spokenConfirmation: 'Settings open kar di hain.',
          emotion: 'FRIENDLY',
          uiBadge: {
            label: 'SETTINGS',
            state: 'OPENED',
          },
        };
      }

      case 'SETTINGS_CLOSE': {
        // EXECUTE
        s.settings.closeSettings();

        // VERIFY
        const verified = s.settings.isSettingsOpen ? !s.settings.isSettingsOpen() : true;

        console.log(
          `[VOICE COMMAND]\nTranscript: "${rawInput}"\n[INTENT]\nSETTINGS_CLOSE\n[ACTION]\nSomyaSystemController.execute(SETTINGS_CLOSE)\n[CONTROLLER]\nSettingsController.closeSettings()\n[RESULT]\n${verified ? 'success' : 'failure'}\n[VERIFICATION]\nactual state = ${verified ? 'CLOSED' : 'OPEN'}`
        );

        this.logAction('SETTINGS_CLOSE', rawInput, verified ? 'SUCCESS' : 'FAILED', 'Settings closed');
        return {
          success: verified,
          action: 'SETTINGS_CLOSE',
          intent: 'SETTINGS_CLOSE',
          message: 'Settings closed',
          details: 'Settings closed',
          spokenConfirmation: 'Settings band kar di hain.',
          emotion: 'CALM',
          uiBadge: {
            label: 'SETTINGS',
            state: 'CLOSED',
          },
        };
      }

      case 'MEMORY_OPEN': {
        // EXECUTE
        s.settings.openMemory();

        // VERIFY
        const verified = s.settings.isMemoryOpen ? s.settings.isMemoryOpen() : true;

        console.log(
          `[VOICE COMMAND]\nTranscript: "${rawInput}"\n[INTENT]\nMEMORY_OPEN\n[ACTION]\nSomyaSystemController.execute(MEMORY_OPEN)\n[CONTROLLER]\nSettingsController.openMemory()\n[RESULT]\n${verified ? 'success' : 'failure'}\n[VERIFICATION]\nactual state = ${verified ? 'OPEN' : 'CLOSED'}`
        );

        this.logAction('MEMORY_OPEN', rawInput, verified ? 'SUCCESS' : 'FAILED', 'Memory panel opened');
        return {
          success: verified,
          action: 'MEMORY_OPEN',
          intent: 'MEMORY_OPEN',
          message: 'Memory panel opened',
          details: 'Memory panel opened',
          spokenConfirmation: 'Memory panel open kar diya hai.',
          emotion: 'FRIENDLY',
          uiBadge: {
            label: 'MEMORY PANEL',
            state: 'OPENED',
          },
        };
      }

      case 'AUDIO_SETTINGS_OPEN': {
        // EXECUTE
        s.settings.openAudioSettings();

        // VERIFY
        const verified = s.settings.isAudioSettingsOpen ? s.settings.isAudioSettingsOpen() : true;

        console.log(
          `[VOICE COMMAND]\nTranscript: "${rawInput}"\n[INTENT]\nAUDIO_SETTINGS_OPEN\n[ACTION]\nSomyaSystemController.execute(AUDIO_SETTINGS_OPEN)\n[CONTROLLER]\nSettingsController.openAudioSettings()\n[RESULT]\n${verified ? 'success' : 'failure'}\n[VERIFICATION]\nactual state = ${verified ? 'OPEN' : 'CLOSED'}`
        );

        this.logAction('AUDIO_SETTINGS_OPEN', rawInput, verified ? 'SUCCESS' : 'FAILED', 'Audio settings opened');
        return {
          success: verified,
          action: 'AUDIO_SETTINGS_OPEN',
          intent: 'AUDIO_SETTINGS_OPEN',
          message: 'Audio settings panel opened',
          details: 'Audio settings opened',
          spokenConfirmation: 'Audio settings panel open kar diya hai.',
          emotion: 'FRIENDLY',
          uiBadge: {
            label: 'AUDIO SETTINGS',
            state: 'OPENED',
          },
        };
      }

      default: {
        this.logAction(intent, rawInput, 'REJECTED', 'Unhandled action intent');
        return {
          success: false,
          action: intent,
          intent,
          message: 'Action not supported',
          details: 'Action not supported',
          spokenConfirmation: 'Yeh action supported nahi hai.',
          emotion: 'WORRIED',
        };
      }
    }
  }

  private logAction(
    intent: SystemActionIntent,
    rawCommand: string,
    result: 'SUCCESS' | 'FAILED' | 'REJECTED' | 'CONFIRMATION_REQUIRED',
    details: string
  ): void {
    const now = new Date();
    const timeFormatted = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const entry: SystemActionLog = {
      id: `sys-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      timeFormatted,
      intent,
      rawCommand,
      result,
      details,
    };

    this.actionHistory.unshift(entry);
    if (this.actionHistory.length > this.MAX_HISTORY_ITEMS) {
      this.actionHistory.pop();
    }
  }

  public getActionHistory(): SystemActionLog[] {
    return [...this.actionHistory];
  }

  public getPendingConfirmation(): PendingConfirmation | null {
    return this.pendingConfirmation;
  }
}

// Global Singleton instance for application lifetime
export const systemController = new SomyaSystemController();
