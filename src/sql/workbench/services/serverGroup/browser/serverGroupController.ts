/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import Severity from 'vs/base/common/severity';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

import { SERVER_GROUP_CONFIG, SERVER_GROUP_COLORS_CONFIG } from 'sql/workbench/parts/objectExplorer/common/serverGroup.contribution';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { IServerGroupController, IServerGroupDialogCallbacks } from 'sql/platform/serverGroup/common/serverGroupController';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ServerGroupDialog } from 'sql/workbench/parts/objectExplorer/browser/serverGroupDialog';
import { ServerGroupViewModel } from 'sql/workbench/parts/objectExplorer/common/serverGroupViewModel';
import { ConnectionProfileGroup, IConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';

export class ServerGroupController implements IServerGroupController {
	_serviceBrand: any;

	private _serverGroupDialog: ServerGroupDialog;
	private _callbacks: IServerGroupDialogCallbacks;
	private _group: ConnectionProfileGroup;
	private _viewModel: ServerGroupViewModel;

	constructor(
		@IErrorMessageService private readonly errorMessageService: IErrorMessageService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService
	) {
	}

	private handleOnAddServerGroup(): void {
		if (this._group) {
			let tempGroup: ConnectionProfileGroup = this.copyConnectionProfileGroup(this._group);
			this._group.name = this._viewModel.groupName;
			this._group.color = this._viewModel.groupColor;
			this._group.description = this._viewModel.groupDescription;
			this.connectionManagementService.editGroup(this._group).then(() => {
				this._serverGroupDialog.close();
			}).catch(err => {
				// rollback changes made
				this._group = tempGroup;
				this.errorMessageService.showDialog(Severity.Error, '', err);
			});

		} else {
			let newGroup: IConnectionProfileGroup = {
				name: this._viewModel.groupName,
				id: undefined,
				parentId: undefined,
				color: this._viewModel.groupColor,
				description: this._viewModel.groupDescription
			};
			this.connectionManagementService.saveProfileGroup(newGroup).then(groupId => {
				if (this._callbacks) {
					this._callbacks.onAddGroup(this._serverGroupDialog.groupName);
				}
				this._serverGroupDialog.close();
			}).catch(err => {
				this.errorMessageService.showDialog(Severity.Error, '', err);
			});
		}
	}

	private copyConnectionProfileGroup(group: ConnectionProfileGroup): ConnectionProfileGroup {
		return new ConnectionProfileGroup(group.name, group.parent, group.id, group.color, group.description);
	}

	private handleOnClose(): void {
		if (this._callbacks) {
			this._callbacks.onClose();
		}
	}


	public showCreateGroupDialog(callbacks?: IServerGroupDialogCallbacks): Promise<void> {
		this._group = null;
		this._viewModel = new ServerGroupViewModel(undefined, this.configurationService.getValue(SERVER_GROUP_CONFIG)[SERVER_GROUP_COLORS_CONFIG]);
		this._callbacks = callbacks ? callbacks : undefined;
		return this.openServerGroupDialog();
	}

	public showEditGroupDialog(group: ConnectionProfileGroup): Promise<void> {
		this._group = group;
		this._viewModel = new ServerGroupViewModel(group, this.configurationService.getValue(SERVER_GROUP_CONFIG)[SERVER_GROUP_COLORS_CONFIG]);
		return this.openServerGroupDialog();
	}

	private openServerGroupDialog(): Promise<void> {
		if (!this._serverGroupDialog) {
			this._serverGroupDialog = this.instantiationService.createInstance(ServerGroupDialog);
			this._serverGroupDialog.viewModel = this._viewModel;
			this._serverGroupDialog.onCancel(() => { });
			this._serverGroupDialog.onAddServerGroup(() => this.handleOnAddServerGroup());
			this._serverGroupDialog.onCloseEvent(() => this.handleOnClose());
			this._serverGroupDialog.render();
		} else {
			// reset the view model in the view
			this._serverGroupDialog.viewModel = this._viewModel;
		}

		return new Promise<void>(() => {
			this._serverGroupDialog.open();
		});
	}
}
