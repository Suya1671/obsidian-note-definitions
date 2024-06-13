import { Menu, Plugin } from 'obsidian';
import { injectGlobals } from './globals';
import { logDebug } from './util/log';
import { definitionMarker } from './editor/marker';
import { Extension } from '@codemirror/state';
import { DefManager, initDefFileManager } from './core/def-file-manager';
import { getWordUnderCursor } from './util/editor';
import { Definition } from './core/model';
import { getDefinitionPopover, initDefinitionPopover } from './editor/definition-popover';
import { postProcessor } from './editor/md-postprocessor';
import { DEFAULT_SETTINGS, SettingsTab } from './settings';

export default class NoteDefinition extends Plugin {
	activeEditorExtensions: Extension[] = [];
	defManager: DefManager;

	async onload() {
		// Settings are injected into global object
		const settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
		injectGlobals(settings);

		logDebug("Load note definition plugin");

		initDefinitionPopover(this);
		this.defManager = initDefFileManager(this.app);

		this.registerCommands();
		this.registerEvents();
		this.registerEditorExtension(this.activeEditorExtensions);

		this.addSettingTab(new SettingsTab(this.app, this));
		this.registerMarkdownPostProcessor(postProcessor);
	}

	async saveSettings() {
		await this.saveData(window.NoteDefinition.settings);
	}

	registerCommands() {
		this.addCommand({
			id: "preview-definition",
			name: "Preview definition",
			editorCallback: (editor) => {
				const curWord = getWordUnderCursor(editor);
				if (!curWord) return;
				const def = window.NoteDefinition.definitions.global.get(curWord);
				if (!def) return;
				getDefinitionPopover().openAtCursor(def);
			}
		});

		this.addCommand({
			id: "goto-definition",
			name: "Go to definition",
			editorCallback: (editor) => {
				const currWord = getWordUnderCursor(editor);
				if (!currWord) return;
				const def = this.defManager.get(currWord);
				if (!def) return;
				this.app.workspace.openLinkText(def.linkText, '');
			}
		})
	}

	registerEvents() {
		this.registerEvent(this.app.workspace.on("active-leaf-change", async (leaf) => {
			if (!leaf) return;
			this.refreshDefinitions();
			this.registerEditorExts();
		}));

		// Add editor menu option to preview definition
		this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor) => {
			const curWord = getWordUnderCursor(editor);
			if (!curWord) return;
			const def = this.defManager.get(curWord);
			if (!def) return;
			this.registerMenuItems(menu, def);
		}));

	}

	registerMenuItems(menu: Menu, def: Definition) {
		menu.addItem((item) => {
			item.setTitle("Go to definition")
				.setIcon("arrow-left-from-line")
				.onClick(() => {
					this.app.workspace.openLinkText(def.linkText, '');
				});
		})
	}

	refreshDefinitions() {
		this.defManager.loadDefinitions();
	}

	registerEditorExts() {
		const currFile = this.app.workspace.getActiveFile();
		if (currFile && this.defManager.isDefFile(currFile)) {
			// TODO: Editor extension for definition file
			this.setActiveEditorExtensions([]);
		} else {
			this.setActiveEditorExtensions(definitionMarker);
		}
	}

	private setActiveEditorExtensions(...ext: Extension[]) {
		this.activeEditorExtensions.length = 0;
		this.activeEditorExtensions.push(...ext);
		this.app.workspace.updateOptions();
	}

	onunload() {
		logDebug("Unload note definition plugin");
		getDefinitionPopover().cleanUp();
	}
}
