import * as pulumi from "@pulumi/pulumi";
import * as azuread from "@pulumi/azuread";
import * as service from "@pulumi/pulumiservice";
import { toTitleCase } from './functions';

// Get some variables 
const config = new pulumi.Config();
const appName = config.require("appName");
const azureSubscriptionId = config.require("azureSubscriptionId");
const pulumiOrgName = config.get("pulumiOrgName") || appName;
const escProjectName = config.get("escProjectName") || pulumi.getProject();
const environmentName = config.get("environmentName") || pulumi.getStack();

// Create an Azure AD application
const current = azuread.getClientConfig({});
const pulumiEscApp = new azuread.Application(`${appName}-pulumi-esc-auth`, {
    displayName: `${toTitleCase(appName)} Pulumi OIDC Connection`,
    owners: [current.then(current => current.objectId)],
});
const servicePrincipal = new azuread.ServicePrincipal(`${appName}-service-principal`, {
    clientId: pulumiEscApp.clientId,
    appRoleAssignmentRequired: false,
    owners: [current.then(current => current.objectId)],
});

// Add federated credentials to the application.
// https://www.pulumi.com/docs/pulumi-cloud/access-management/oidc/provider/azure/#add-federated-credentials
const escCredential = new azuread.ApplicationFederatedIdentityCredential(`${appName}-pulumi-esc-cred`, {
    applicationId: pulumiEscApp.objectId,
    displayName: `${toTitleCase(appName)} OIDC for Pulumi ESC`,
    audiences: [`azure:${pulumiOrgName}` ],
    issuer: "https://api.pulumi.com/oidc",
    subject: `pulumi:environments:org:${pulumiOrgName}:env:${escProjectName}/${environmentName}`,
    description: `Federated credential for Pulumi ESC`,
});

new service.Environment(`${appName}-pulumi-esc-${escProjectName}`, {
    organization: pulumiOrgName,
    project: escProjectName,
    name: environmentName,
    yaml: new pulumi.asset.StringAsset(
`values:
  azure:
    login:
      fn::open::azure-login:
        clientId: ${current.then(current => current.clientId)}
        tenantId: ${current.then(current => current.tenantId)}
        subscriptionId: ${azureSubscriptionId}
        oidc: true
        subjectAttributes:
          - currentEnvironment.name
          - pulumi.user.login
  environmentVariables:
    ARM_USE_OIDC: 'true'
    ARM_CLIENT_ID: \${azure.login.clientId}
    ARM_TENANT_ID: \${azure.login.tenantId}
    ARM_OIDC_TOKEN: \${azure.login.oidc.token}
    ARM_SUBSCRIPTION_ID: \${azure.login.subscriptionId}`
    )
});

// Export the application ID and service principal ID
export const applicationId = escCredential.applicationId;
export const servicePrincipalId = servicePrincipal.id;
